import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { validateQuestionListInput, type QuestionListInput } from "./question-read-query";

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
