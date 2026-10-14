import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { validateQuestionListInput, type QuestionListInput } from "./question-read-query";
import { validateQuestionCreateRequest, validateQuestionUpdateRequest, QuestionValidationError } from "./question-validation";

const questionListSelect = {
  id: true, text: true, type: true, difficulty: true, explanation: true,
  points: true, status: true, source: true, createdAt: true,
  learningObjective: { select: { id: true, title: true } },
  lesson: { select: { id: true, title: true, unit: { select: {
    id: true, title: true, semester: { select: {
      id: true, name: true, academicYear: true, grade: { select: { id: true, name: true } },
    } },
  } } } },
  _count: { select: { options: true, assessmentLinks: true } },
} satisfies Prisma.QuestionSelect;

export async function listQuestions(input: QuestionListInput = {}) {
  await requireAdmin();
  const query = validateQuestionListInput(input);
  const where: Prisma.QuestionWhereInput = {
    ...(query.type ? { type: query.type } : {}),
    ...(query.difficulty ? { difficulty: query.difficulty } : {}),
    lesson: {
      ...(query.lessonId ? { id: query.lessonId } : {}),
      unit: {
        ...(query.unitId ? { id: query.unitId } : {}),
        semester: {
          ...(query.semesterId ? { id: query.semesterId } : {}),
          ...(query.gradeId ? { gradeId: query.gradeId } : {}),
        },
      },
    },
  };
  // One snapshot keeps the count and current page consistent during concurrent writes.
  const [rows, total] = await prisma.$transaction([
    prisma.question.findMany({ where, select: questionListSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.question.count({ where }),
  ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  return { questions: rows.map(({ _count, ...question }) => ({ ...question, optionCount: _count.options, isUsed: _count.assessmentLinks > 0 })),
    total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize) };
}

/** Lightweight selector data, without resources, answers or other curriculum content. */
export async function getQuestionFilterCurriculum() {
  await requireAdmin();
  return prisma.grade.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true, name: true, semesters: {
      orderBy: [{ academicYear: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
      select: { id: true, name: true, academicYear: true, units: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: { id: true, title: true, lessons: {
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, title: true },
        } },
      } },
    } },
  });
}
export type QuestionFilterCurriculum = Awaited<ReturnType<typeof getQuestionFilterCurriculum>>;

export class QuestionCreateError extends Error {
  constructor(public readonly code: "lesson_not_found" | "objective_not_found" | "objective_lesson_mismatch") {
    super({
      lesson_not_found: "الدرس المحدد غير موجود.",
      objective_not_found: "الهدف التعليمي المحدد غير موجود.",
      objective_lesson_mismatch: "يجب أن ينتمي الهدف التعليمي إلى الدرس المحدد.",
    }[code]);
  }
}

export async function createQuestion(input: unknown) {
  const admin = await requireAdmin();
  const data = validateQuestionCreateRequest(input);
  return prisma.$transaction(async tx => {
    const lesson = await tx.lesson.findUnique({ where: { id: data.lessonId }, select: { id: true } });
    if (!lesson) throw new QuestionCreateError("lesson_not_found");
    if (data.learningObjectiveId) {
      const objective = await tx.learningObjective.findUnique({ where: { id: data.learningObjectiveId }, select: { lessonId: true } });
      if (!objective) throw new QuestionCreateError("objective_not_found");
      if (objective.lessonId !== data.lessonId) throw new QuestionCreateError("objective_lesson_mismatch");
    }
    // Nested creation is atomic: any option failure rolls back the question too.
    // Only validated fields are copied; author and workflow fields are server-owned.
    return tx.question.create({
      data: {
        lessonId: data.lessonId, learningObjectiveId: data.learningObjectiveId,
        text: data.text, explanation: data.explanation, type: data.type, difficulty: data.difficulty,
        createdById: admin.id, source: "MANUAL", status: "DRAFT",
        options: { create: data.options.map(option => ({ text: option.text, isCorrect: option.isCorrect, sortOrder: option.sortOrder })) },
      },
      select: {
        id: true, text: true, explanation: true, type: true, difficulty: true,
        lesson: { select: { id: true, title: true } },
        learningObjective: { select: { id: true, title: true } },
        options: { orderBy: { sortOrder: "asc" }, select: { id: true, text: true, sortOrder: true, isCorrect: true } },
      },
    });
  });
}

export async function getQuestionCreationData() {
  await requireAdmin();
  const [curriculum, objectives] = await Promise.all([
    getQuestionFilterCurriculum(),
    prisma.learningObjective.findMany({ select: { id: true, title: true, lessonId: true }, orderBy: { id: "asc" } }),
  ]);
  return { curriculum, objectives };
}
export type QuestionCreationData = Awaited<ReturnType<typeof getQuestionCreationData>>;

export class QuestionMutationError extends Error {
  constructor(public readonly code: "question_not_found" | "question_used" | "question_conflict") {
    super({ question_not_found: "السؤال غير موجود.", question_used: "لا يمكن تعديل أو حذف هذا السؤال لأنه مستخدم في تقييم.",
      question_conflict: "تغيّر السؤال أثناء العملية. أعيدي تحميل الصفحة وحاولي مرة أخرى." }[code]);
  }
}

const questionDetailSelect = {
  ...questionListSelect,
  options: { orderBy: { sortOrder: "asc" }, select: { id: true, text: true, isCorrect: true, sortOrder: true } },
} satisfies Prisma.QuestionSelect;
type QuestionRow = Prisma.QuestionGetPayload<{ select: typeof questionDetailSelect }>;
function questionDetails({ _count, ...question }: QuestionRow) {
  return { ...question, isUsed: _count.assessmentLinks > 0 };
}
function questionIdValue(id: string) {
  if (typeof id !== "string" || !id.trim() || id.trim().length > 128) throw new QuestionValidationError("questionId", "يجب تحديد سؤال صالح.");
  return id.trim();
}

export async function getQuestion(questionId: string) {
  await requireAdmin();
  const question = await prisma.question.findUnique({ where: { id: questionIdValue(questionId) }, select: questionDetailSelect });
  if (!question) throw new QuestionMutationError("question_not_found");
  return questionDetails(question);
}
export type QuestionDetail = Awaited<ReturnType<typeof getQuestion>>;

async function lockUnusedQuestion(tx: Prisma.TransactionClient, id: string) {
  // FOR UPDATE conflicts with FK KEY SHARE locks from new AssessmentQuestion links.
  // ReadCommitted makes the following read see links committed while we waited.
  await tx.$queryRaw`SELECT "id" FROM "questions" WHERE "id" = ${id} FOR UPDATE`;
  const question = await tx.question.findUnique({ where: { id }, select: questionDetailSelect });
  if (!question) throw new QuestionMutationError("question_not_found");
  if (question._count.assessmentLinks > 0) throw new QuestionMutationError("question_used");
  if (question.type !== "MULTIPLE_CHOICE" && question.type !== "TRUE_FALSE") throw new QuestionValidationError("type", "نوع السؤال غير مدعوم في هذه المرحلة.");
  return { ...question, type: question.type };
}
function mutationFailure(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2003") throw new QuestionMutationError("question_conflict");
    if (error.code === "P2025") throw new QuestionMutationError("question_not_found");
    if (error.code === "P2034") throw new QuestionMutationError("question_conflict");
  }
  throw error;
}

export async function updateQuestion(questionId: string, input: unknown) {
  await requireAdmin();
  const id = questionIdValue(questionId);
  try {
    return await prisma.$transaction(async tx => {
      const current = await lockUnusedQuestion(tx, id);
      const data = validateQuestionUpdateRequest(input, { lessonId: current.lesson.id, type: current.type,
        explanation: current.explanation, learningObjectiveId: current.learningObjective?.id ?? null });
      if (data.learningObjectiveId) {
        const objective = await tx.learningObjective.findUnique({ where: { id: data.learningObjectiveId }, select: { lessonId: true } });
        if (!objective) throw new QuestionCreateError("objective_not_found");
        if (objective.lessonId !== current.lesson.id) throw new QuestionCreateError("objective_lesson_mismatch");
      }
      await tx.questionOption.deleteMany({ where: { questionId: id } });
      const updated = await tx.question.update({ where: { id }, data: {
        text: data.text, explanation: data.explanation, difficulty: data.difficulty, learningObjectiveId: data.learningObjectiveId,
        options: { create: data.options.map(o => ({ text: o.text, isCorrect: o.isCorrect, sortOrder: o.sortOrder })) },
      }, select: questionDetailSelect });
      return questionDetails(updated);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  } catch (error) { return mutationFailure(error); }
}

export async function deleteQuestion(questionId: string) {
  await requireAdmin();
  const id = questionIdValue(questionId);
  try {
    await prisma.$transaction(async tx => {
      await lockUnusedQuestion(tx, id);
      await tx.question.delete({ where: { id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") throw new QuestionMutationError("question_used");
    mutationFailure(error);
  }
}
