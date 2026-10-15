import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { validateAssignmentScore } from "./assignment-review-validation";

export class AssignmentReviewServiceError extends Error {
  constructor(public readonly code: "assignment_not_found" | "student_not_found" | "student_not_eligible") {
    super({
      assignment_not_found: "الواجب غير موجود.",
      student_not_found: "الطالبة غير موجودة.",
      student_not_eligible: "لا يمكن تقييم هذه الطالبة لهذا الواجب.",
    }[code]);
    this.name = "AssignmentReviewServiceError";
  }
}

function cleanId(value: unknown, code: "assignment_not_found" | "student_not_found") {
  const id = typeof value === "string" ? value.trim() : "";
  if (!id || id.length > 128) throw new AssignmentReviewServiceError(code);
  return id;
}

const reviewAssignmentSelect = {
  id: true,
  title: true,
  description: true,
  externalUrl: true,
  weekNumber: true,
  gradeId: true,
  lesson: { select: { title: true } },
} satisfies Prisma.AssignmentSelect;

const externalAssignmentWhere = {
  lessonId: { not: null },
  externalUrl: { not: null },
  weekNumber: { not: null },
} satisfies Prisma.AssignmentWhereInput;

export type AssignmentReviewData = {
  assignment: { id: string; title: string; description: string | null; externalUrl: string; weekNumber: number; lessonTitle: string };
  students: Array<{ id: string; fullName: string; sectionName: string; score: 0 | 1 | null; gradedAt: Date | null }>;
};

export async function listAssignmentReviews(assignmentIdInput: unknown): Promise<AssignmentReviewData> {
  await requireAdmin();
  const assignmentId = cleanId(assignmentIdInput, "assignment_not_found");
  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, ...externalAssignmentWhere },
    select: reviewAssignmentSelect,
  });
  if (!assignment || !assignment.lesson || assignment.externalUrl === null || assignment.weekNumber === null) {
    throw new AssignmentReviewServiceError("assignment_not_found");
  }

  const students = await prisma.student.findMany({
    where: { isActive: true, currentSection: { gradeId: assignment.gradeId } },
    orderBy: [{ fullName: "asc" }, { id: "asc" }],
    select: {
      id: true,
      fullName: true,
      currentSection: { select: { id: true, name: true } },
      assignmentGrades: {
        where: { assignmentId },
        take: 1,
        select: { score: true, gradedAt: true },
      },
    },
  });

  return {
    assignment: {
      id: assignment.id,
      title: assignment.title,
      description: assignment.description,
      externalUrl: assignment.externalUrl,
      weekNumber: assignment.weekNumber,
      lessonTitle: assignment.lesson.title,
    },
    students: students.map(student => ({
      id: student.id,
      fullName: student.fullName,
      sectionName: student.currentSection?.name ?? "بدون شعبة",
      score: student.assignmentGrades[0]?.score === 0 || student.assignmentGrades[0]?.score === 1
        ? student.assignmentGrades[0].score as 0 | 1
        : null,
      gradedAt: student.assignmentGrades[0]?.gradedAt ?? null,
    })),
  };
}

export async function setAssignmentGrade(input: { assignmentId: unknown; studentId: unknown; score: unknown }) {
  const admin = await requireAdmin();
  const assignmentId = cleanId(input.assignmentId, "assignment_not_found");
  const studentId = cleanId(input.studentId, "student_not_found");
  const score = validateAssignmentScore({ score: input.score });

  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, ...externalAssignmentWhere },
    select: { id: true, gradeId: true },
  });
  if (!assignment) throw new AssignmentReviewServiceError("assignment_not_found");

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, isActive: true, currentSection: { select: { gradeId: true } } },
  });
  if (!student) throw new AssignmentReviewServiceError("student_not_found");
  if (!student.isActive || student.currentSection?.gradeId !== assignment.gradeId) {
    throw new AssignmentReviewServiceError("student_not_eligible");
  }

  return prisma.assignmentGrade.upsert({
    where: { assignmentId_studentId: { assignmentId, studentId } },
    create: { assignmentId, studentId, submissionId: null, score, feedback: null, gradedById: admin.id },
    update: { score, gradedById: admin.id, gradedAt: new Date() },
    select: { score: true, gradedAt: true },
  });
}
