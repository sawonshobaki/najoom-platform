import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { validateQuestionListInput, type QuestionListInput } from "./question-read-query";
import { validateQuestionCreateRequest } from "./question-validation";

const questionListSelect = {
  id: true, text: true, type: true, difficulty: true, explanation: true,
  points: true, status: true, source: true, createdAt: true,
  learningObjective: { select: { id: true, title: true } },
  lesson: { select: { id: true, title: true, unit: { select: {
    id: true, title: true, semester: { select: {
      id: true, name: true, academicYear: true, grade: { select: { id: true, name: true } },
    } },
  } } } },
  _count: { select: { options: true } },
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
  return { questions: rows.map(({ _count, ...question }) => ({ ...question, optionCount: _count.options })),
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
