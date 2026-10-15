import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { validateAssessmentCreateRequest } from "./assessment-validation";

const assessmentListSelect = {
  id: true,
  title: true,
  type: true,
  status: true,
  durationSeconds: true,
  createdAt: true,
  lesson: { select: { id: true, title: true, unit: { select: {
    id: true, title: true, semester: { select: {
      id: true, name: true, academicYear: true, grade: { select: { id: true, name: true } },
    } },
  } } } },
  questions: { select: { pointsOverride: true, question: { select: { points: true } } } },
} satisfies Prisma.AssessmentSelect;

const assessmentDetailSelect = {
  ...assessmentListSelect,
  questions: { orderBy: { sortOrder: "asc" as const }, select: {
    id: true, sortOrder: true, pointsOverride: true, questionSnapshot: true,
    question: { select: { id: true, text: true, type: true, difficulty: true, points: true } },
  } },
} satisfies Prisma.AssessmentSelect;

type AssessmentListRow = Prisma.AssessmentGetPayload<{ select: typeof assessmentListSelect }>;
function summarize(row: AssessmentListRow) {
  const { questions, ...assessment } = row;
  return {
    ...assessment,
    questionCount: questions.length,
    totalPoints: questions.reduce((sum, item) => sum + (item.pointsOverride ?? item.question.points), 0),
  };
}

export class AssessmentServiceError extends Error {
  constructor(public readonly code:
    | "lesson_not_found" | "question_not_found" | "question_lesson_mismatch" | "question_type_unsupported"
    | "assessment_not_found" | "assessment_invalid_transition" | "assessment_empty"
    | "assessment_invalid_questions" | "assessment_conflict") {
    super({
      lesson_not_found: "الدرس المحدد غير موجود.",
      question_not_found: "أحد الأسئلة المحددة غير موجود.",
      question_lesson_mismatch: "يجب أن تنتمي جميع الأسئلة إلى الدرس المحدد.",
      question_type_unsupported: "أحد الأسئلة المحددة من نوع غير مدعوم في هذه المرحلة.",
      assessment_not_found: "الاختبار غير موجود.",
      assessment_invalid_transition: "لا يمكن تغيير حالة الاختبار بهذه الطريقة.",
      assessment_empty: "لا يمكن نشر اختبار لا يحتوي أسئلة.",
      assessment_invalid_questions: "تعذر نشر الاختبار لأن أسئلته أو ترتيبها أو نقاطها غير صالحة.",
      assessment_conflict: "تغيّرت حالة الاختبار أثناء العملية. أعيدي تحميل الصفحة.",
    }[code]);
  }
}

function validAssessmentId(value: string) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 128) {
    throw new AssessmentServiceError("assessment_not_found");
  }
  return value.trim();
}

export async function listAssessments() {
  await requireAdmin();
  const rows = await prisma.assessment.findMany({
    select: assessmentListSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return rows.map(summarize);
}

export async function getAssessment(assessmentId: string) {
  await requireAdmin();
  const row = await prisma.assessment.findUnique({ where: { id: validAssessmentId(assessmentId) }, select: assessmentDetailSelect });
  if (!row) throw new AssessmentServiceError("assessment_not_found");
  return {
    ...row,
    questionCount: row.questions.length,
    totalPoints: row.questions.reduce((sum, item) => sum + (item.pointsOverride ?? item.question.points), 0),
  };
}

async function transitionAssessment(assessmentIdInput: string, target: "PUBLISHED" | "CLOSED") {
  await requireAdmin();
  const assessmentId = validAssessmentId(assessmentIdInput);
  return prisma.$transaction(async tx => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "assessments" WHERE "id" = ${assessmentId} FOR UPDATE`);
    const assessment = await tx.assessment.findUnique({ where: { id: assessmentId }, select: {
      id: true, status: true,
      questions: { orderBy: { sortOrder: "asc" }, select: {
        questionId: true, sortOrder: true, pointsOverride: true,
        question: { select: { type: true, points: true, options: { orderBy: { sortOrder: "asc" }, select: { text: true, sortOrder: true, isCorrect: true } } } },
      } },
    } });
    if (!assessment) throw new AssessmentServiceError("assessment_not_found");
    const expected = target === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    if (assessment.status !== expected) throw new AssessmentServiceError("assessment_invalid_transition");
    if (target === "PUBLISHED") {
      if (!assessment.questions.length) throw new AssessmentServiceError("assessment_empty");
      const questionIds = new Set(assessment.questions.map(item => item.questionId));
      const validQuestions = questionIds.size === assessment.questions.length
        && assessment.questions.every((item, index) => {
          const options = item.question.options;
          const ordered = options.every((option, optionIndex) => option.sortOrder === optionIndex + 1);
          const oneCorrect = options.filter(option => option.isCorrect).length === 1;
          const validOptions = item.question.type === "MULTIPLE_CHOICE"
            ? options.length >= 2 && options.length <= 6 && oneCorrect && ordered
              && options.every(option => option.text.trim())
              && new Set(options.map(option => option.text.trim().toLocaleLowerCase("ar"))).size === options.length
            : item.question.type === "TRUE_FALSE"
              ? options.length === 2 && oneCorrect && ordered && options[0]?.text === "صحيح" && options[1]?.text === "خطأ"
              : false;
          return item.sortOrder === index + 1 && validOptions && (item.pointsOverride ?? item.question.points) > 0;
        });
      const totalPoints = assessment.questions.reduce((sum, item) => sum + (item.pointsOverride ?? item.question.points), 0);
      if (!validQuestions || totalPoints <= 0) throw new AssessmentServiceError("assessment_invalid_questions");
    }
    const updated = await tx.assessment.updateMany({ where: { id: assessmentId, status: expected }, data: { status: target } });
    if (updated.count !== 1) throw new AssessmentServiceError("assessment_conflict");
    return { id: assessmentId, status: target };
  });
}

export function publishAssessment(assessmentId: string) {
  return transitionAssessment(assessmentId, "PUBLISHED");
}

export function closeAssessment(assessmentId: string) {
  return transitionAssessment(assessmentId, "CLOSED");
}

export async function createAssessment(input: unknown) {
  const admin = await requireAdmin();
  const data = validateAssessmentCreateRequest(input);
  return prisma.$transaction(async tx => {
    const lesson = await tx.lesson.findUnique({
      where: { id: data.lessonId },
      select: { id: true, unit: { select: { semester: { select: { gradeId: true } } } } },
    });
    if (!lesson) throw new AssessmentServiceError("lesson_not_found");

    const questions = await tx.question.findMany({
      where: { id: { in: data.questionIds } },
      select: { id: true, lessonId: true, type: true },
    });
    if (questions.length !== data.questionIds.length) throw new AssessmentServiceError("question_not_found");
    if (questions.some(question => question.lessonId !== data.lessonId)) throw new AssessmentServiceError("question_lesson_mismatch");
    if (questions.some(question => question.type !== "MULTIPLE_CHOICE" && question.type !== "TRUE_FALSE")) {
      throw new AssessmentServiceError("question_type_unsupported");
    }

    return tx.assessment.create({
      data: {
        title: data.title,
        lessonId: lesson.id,
        gradeId: lesson.unit.semester.gradeId,
        type: "QUIZ",
        status: "DRAFT",
        durationSeconds: 0,
        createdById: admin.id,
        questions: { create: data.questionIds.map((questionId, index) => ({
          questionId,
          sortOrder: index + 1,
          pointsOverride: null,
        })) },
      },
      select: assessmentDetailSelect,
    });
  });
}

export async function getAssessmentCreationData() {
  await requireAdmin();
  const [curriculum, questions] = await Promise.all([
    prisma.grade.findMany({
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
    }),
    prisma.question.findMany({
      where: { type: { in: ["MULTIPLE_CHOICE", "TRUE_FALSE"] } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, lessonId: true, text: true, type: true, difficulty: true, points: true },
    }),
  ]);
  return { curriculum, questions };
}

export type AssessmentCreationData = Awaited<ReturnType<typeof getAssessmentCreationData>>;
