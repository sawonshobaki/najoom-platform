import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { requireAdmin, requireStudent } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { validateExternalAssignmentCreate } from "./assignment-validation";

export class AssignmentServiceError extends Error {
  constructor(public readonly code: "lesson_not_found" | "assignment_not_found" | "student_not_found") {
    super({ lesson_not_found: "الدرس المحدد غير موجود.", assignment_not_found: "الواجب غير موجود.", student_not_found: "ملف الطالبة غير متاح." }[code]);
    this.name = "AssignmentServiceError";
  }
}

const assignmentSelect = {
  id: true, title: true, description: true, externalUrl: true, weekNumber: true, createdAt: true,
  lesson: { select: { id: true, title: true, unit: { select: { id: true, title: true, semester: { select: {
    id: true, name: true, academicYear: true, grade: { select: { id: true, name: true } },
  } } } } } },
} satisfies Prisma.AssignmentSelect;

type AssignmentRow = Prisma.AssignmentGetPayload<{ select: typeof assignmentSelect }>;
export type ExternalAssignment = Omit<AssignmentRow, "lesson" | "externalUrl" | "weekNumber"> & {
  externalUrl: string;
  weekNumber: number;
  lesson: NonNullable<AssignmentRow["lesson"]>;
};

function external(row: AssignmentRow): ExternalAssignment {
  if (!row.lesson || row.externalUrl === null || row.weekNumber === null) throw new AssignmentServiceError("assignment_not_found");
  return { ...row, lesson: row.lesson, externalUrl: row.externalUrl, weekNumber: row.weekNumber };
}

const externalWhere = { lessonId: { not: null }, externalUrl: { not: null }, weekNumber: { not: null } } satisfies Prisma.AssignmentWhereInput;

export async function listAssignments() {
  await requireAdmin();
  const rows = await prisma.assignment.findMany({ where: externalWhere, select: assignmentSelect, orderBy: [{ weekNumber: "desc" }, { createdAt: "desc" }, { id: "desc" }] });
  return rows.map(external);
}

export async function getAssignment(assignmentIdInput: string) {
  await requireAdmin();
  const assignmentId = typeof assignmentIdInput === "string" ? assignmentIdInput.trim() : "";
  if (!assignmentId || assignmentId.length > 128) throw new AssignmentServiceError("assignment_not_found");
  const row = await prisma.assignment.findFirst({ where: { id: assignmentId, ...externalWhere }, select: assignmentSelect });
  if (!row) throw new AssignmentServiceError("assignment_not_found");
  return external(row);
}

export async function createAssignment(input: unknown) {
  const admin = await requireAdmin();
  const data = validateExternalAssignmentCreate(input);
  const lesson = await prisma.lesson.findUnique({ where: { id: data.lessonId }, select: { id: true, unit: { select: { semester: { select: { gradeId: true } } } } } });
  if (!lesson) throw new AssignmentServiceError("lesson_not_found");
  const row = await prisma.assignment.create({ data: {
    lessonId: lesson.id, gradeId: lesson.unit.semester.gradeId, sectionId: null,
    title: data.title, description: data.description, externalUrl: data.externalUrl, weekNumber: data.weekNumber,
    prompt: null, maxScore: null, dueAt: null, status: "PUBLISHED", createdById: admin.id,
  }, select: assignmentSelect });
  return external(row);
}

export async function getAssignmentCreationData() {
  await requireAdmin();
  return prisma.grade.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true, name: true,
      semesters: {
        orderBy: [{ academicYear: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
        select: {
          id: true, name: true, academicYear: true,
          units: {
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            select: {
              id: true, title: true,
              lessons: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, title: true } },
            },
          },
        },
      },
    },
  });
}

export async function listStudentAssignments() {
  const user = await requireStudent();
  const student = await prisma.student.findUnique({ where: { userId: user.id }, select: { id: true, isActive: true, currentSectionId: true, currentSection: { select: { gradeId: true } } } });
  if (!student?.isActive) throw new AssignmentServiceError("student_not_found");
  if (!student.currentSection) return [];
  const rows = await prisma.assignment.findMany({ where: {
    ...externalWhere, gradeId: student.currentSection.gradeId, status: "PUBLISHED",
    OR: [{ sectionId: null }, { sectionId: student.currentSectionId }],
  }, select: assignmentSelect, orderBy: [{ weekNumber: "desc" }, { createdAt: "desc" }, { id: "desc" }] });
  return rows.map(external);
}

export type AssignmentCreationData = Awaited<ReturnType<typeof getAssignmentCreationData>>;
