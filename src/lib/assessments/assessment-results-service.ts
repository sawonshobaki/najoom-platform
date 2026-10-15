import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { AssessmentServiceError } from "./assessment-service";

const resultsSelect = {
  id: true,
  title: true,
  status: true,
  lesson: { select: { id: true, title: true } },
  questions: { select: { pointsOverride: true, question: { select: { points: true } } } },
  attempts: {
    orderBy: [{ submittedAt: "desc" as const }, { startedAt: "desc" as const }, { id: "desc" as const }],
    select: {
      id: true, status: true, startedAt: true, submittedAt: true, score: true, maxScore: true,
      student: { select: { id: true, fullName: true } },
    },
  },
} satisfies Prisma.AssessmentSelect;

function percentage(score: number | null, maxScore: number | null) {
  return score !== null && maxScore !== null && maxScore > 0 ? Math.round((score / maxScore) * 10000) / 100 : null;
}

export async function getAssessmentResults(assessmentIdInput: string) {
  await requireAdmin();
  if (typeof assessmentIdInput !== "string" || !assessmentIdInput.trim() || assessmentIdInput.trim().length > 128) {
    throw new AssessmentServiceError("assessment_not_found");
  }
  const assessment = await prisma.assessment.findUnique({ where: { id: assessmentIdInput.trim() }, select: resultsSelect });
  if (!assessment) throw new AssessmentServiceError("assessment_not_found");
  const attempts = assessment.attempts.map(attempt => ({ ...attempt, percentage: percentage(attempt.score, attempt.maxScore) }));
  const graded = attempts.filter(attempt => attempt.status === "GRADED" && attempt.score !== null && attempt.maxScore !== null);
  const averageScore = graded.length ? Math.round((graded.reduce((sum, attempt) => sum + attempt.score!, 0) / graded.length) * 100) / 100 : null;
  const percentages = graded.map(attempt => attempt.percentage).filter((value): value is number => value !== null);
  const averagePercentage = percentages.length ? Math.round((percentages.reduce((sum, value) => sum + value, 0) / percentages.length) * 100) / 100 : null;
  return {
    id: assessment.id, title: assessment.title, status: assessment.status, lesson: assessment.lesson,
    questionCount: assessment.questions.length,
    maxScore: assessment.questions.reduce((sum, item) => sum + (item.pointsOverride ?? item.question.points), 0),
    totalAttempts: attempts.length, gradedAttempts: graded.length, averageScore, averagePercentage, attempts,
  };
}

export type AssessmentResults = Awaited<ReturnType<typeof getAssessmentResults>>;
