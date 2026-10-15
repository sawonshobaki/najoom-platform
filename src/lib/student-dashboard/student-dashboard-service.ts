import "server-only";

import { requireStudent } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";

export class StudentDashboardServiceError extends Error {
  constructor() {
    super("ملف الطالبة غير متاح.");
    this.name = "StudentDashboardServiceError";
  }
}

const emptySummary = {
  completedAssessments: 0,
  assessmentAverage: 0,
  assignmentEarnedPoints: 0,
  gradedAssignments: 0,
};

function percentage(score: number, maxScore: number) {
  return maxScore > 0 ? Math.round((score / maxScore) * 10000) / 100 : 0;
}

export async function getStudentDashboardData() {
  const user = await requireStudent();
  const student = await prisma.student.findUnique({
    where: { userId: user.id },
    select: {
      id: true,
      fullName: true,
      isActive: true,
      currentSection: { select: { id: true, name: true, grade: { select: { id: true, name: true } } } },
    },
  });
  if (!student?.isActive) throw new StudentDashboardServiceError();

  const profile = {
    fullName: student.fullName,
    section: student.currentSection ? { id: student.currentSection.id, name: student.currentSection.name } : null,
    grade: student.currentSection ? student.currentSection.grade : null,
  };
  if (!student.currentSection) {
    return { student: profile, assignments: [], availableAssessments: [], recentResults: [], summary: emptySummary };
  }

  const gradeId = student.currentSection.grade.id;
  const sectionId = student.currentSection.id;
  const [assignmentRows, assessmentRows, gradedAttempts, assignmentGrades] = await Promise.all([
    prisma.assignment.findMany({
      where: {
        gradeId, status: "PUBLISHED", lessonId: { not: null }, externalUrl: { not: null }, weekNumber: { not: null },
        OR: [{ sectionId: null }, { sectionId }],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 5,
      select: {
        id: true, title: true, externalUrl: true, weekNumber: true,
        lesson: { select: { title: true } },
        grades: { where: { studentId: student.id }, take: 1, select: { score: true } },
      },
    }),
    prisma.assessment.findMany({
      where: {
        gradeId, status: "PUBLISHED", OR: [{ sectionId: null }, { sectionId }],
        attempts: { none: { studentId: student.id } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 5,
      select: { id: true, title: true, lesson: { select: { title: true } }, _count: { select: { questions: true } } },
    }),
    prisma.assessmentAttempt.findMany({
      where: { studentId: student.id, status: "GRADED", score: { not: null }, maxScore: { not: null }, submittedAt: { not: null } },
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      select: { id: true, score: true, maxScore: true, submittedAt: true, assessment: { select: { id: true, title: true } } },
    }),
    prisma.assignmentGrade.findMany({
      where: { studentId: student.id, assignment: { gradeId, lessonId: { not: null }, externalUrl: { not: null }, weekNumber: { not: null } } },
      select: { score: true },
    }),
  ]);

  const assignments = assignmentRows.flatMap(row => {
    if (!row.lesson || row.externalUrl === null || row.weekNumber === null) return [];
    const score = row.grades[0]?.score;
    return [{ id: row.id, title: row.title, lessonTitle: row.lesson.title, externalUrl: row.externalUrl, weekNumber: row.weekNumber,
      score: score === 0 || score === 1 ? score as 0 | 1 : null }];
  });
  const availableAssessments = assessmentRows.map(row => ({
    id: row.id, title: row.title, lessonTitle: row.lesson.title, questionCount: row._count.questions,
  }));
  const safeAttempts = gradedAttempts.flatMap(attempt => {
    if (attempt.score === null || attempt.maxScore === null || attempt.submittedAt === null) return [];
    return [{ id: attempt.id, assessmentId: attempt.assessment.id, title: attempt.assessment.title,
      score: attempt.score, maxScore: attempt.maxScore, percentage: percentage(attempt.score, attempt.maxScore), submittedAt: attempt.submittedAt }];
  });
  const average = safeAttempts.length
    ? Math.round(safeAttempts.reduce((sum, attempt) => sum + attempt.percentage, 0) / safeAttempts.length)
    : 0;

  return {
    student: profile,
    assignments,
    availableAssessments,
    recentResults: safeAttempts.slice(0, 5),
    summary: {
      completedAssessments: safeAttempts.length,
      assessmentAverage: average,
      assignmentEarnedPoints: assignmentGrades.reduce((sum, grade) => sum + grade.score, 0),
      gradedAssignments: assignmentGrades.length,
    },
  };
}

export type StudentDashboardData = Awaited<ReturnType<typeof getStudentDashboardData>>;
