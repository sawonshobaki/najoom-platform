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
  constructor(public readonly code: "lesson_not_found" | "question_not_found" | "question_lesson_mismatch" | "question_type_unsupported" | "assessment_not_found") {
    super({
      lesson_not_found: "الدرس المحدد غير موجود.",
      question_not_found: "أحد الأسئلة المحددة غير موجود.",
      question_lesson_mismatch: "يجب أن تنتمي جميع الأسئلة إلى الدرس المحدد.",
      question_type_unsupported: "أحد الأسئلة المحددة من نوع غير مدعوم في هذه المرحلة.",
      assessment_not_found: "الاختبار غير موجود.",
    }[code]);
  }
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
  if (typeof assessmentId !== "string" || !assessmentId.trim() || assessmentId.trim().length > 128) {
    throw new AssessmentServiceError("assessment_not_found");
  }
  const row = await prisma.assessment.findUnique({ where: { id: assessmentId.trim() }, select: assessmentDetailSelect });
  if (!row) throw new AssessmentServiceError("assessment_not_found");
  return {
    ...row,
    questionCount: row.questions.length,
    totalPoints: row.questions.reduce((sum, item) => sum + (item.pointsOverride ?? item.question.points), 0),
  };
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
