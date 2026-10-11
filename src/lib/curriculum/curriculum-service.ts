import "server-only";

import { requireAdmin } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";

export type CurriculumServiceErrorCode =
  | "invalid_request_body"
  | "invalid_grade_id"
  | "grade_not_found"
  | "invalid_semester_name"
  | "invalid_academic_year"
  | "invalid_sort_order"
  | "semester_not_found"
  | "semester_order_conflict";

export class CurriculumServiceError extends Error {
  constructor(public readonly code: CurriculumServiceErrorCode) {
    super(code);
    this.name = "CurriculumServiceError";
  }
}

export type SemesterInput = {
  name: string;
  academicYear: string;
  sortOrder: number;
};

const semesterSelect = {
  id: true,
  gradeId: true,
  name: true,
  academicYear: true,
  sortOrder: true,
} as const;

function normalizeSemesterInput(input: SemesterInput): SemesterInput {
  const name = input.name.trim();
  const academicYear = input.academicYear.trim();

  if (!name || name.length > 100) {
    throw new CurriculumServiceError("invalid_semester_name");
  }

  if (
    !/^[1-9]\d{3}-[1-9]\d{3}$/.test(academicYear) ||
    Number(academicYear.slice(5)) !== Number(academicYear.slice(0, 4)) + 1
  ) {
    throw new CurriculumServiceError("invalid_academic_year");
  }

  if (
    !Number.isInteger(input.sortOrder) ||
    input.sortOrder < 1 ||
    input.sortOrder > 2_147_483_647
  ) {
    throw new CurriculumServiceError("invalid_sort_order");
  }

  return { name, academicYear, sortOrder: input.sortOrder };
}

async function requireGrade(gradeId: string) {
  const grade = await prisma.grade.findUnique({
    where: { id: gradeId },
    select: { id: true },
  });

  if (!grade) {
    throw new CurriculumServiceError("grade_not_found");
  }
}

function mapSemesterWriteError(error: unknown): never {
  if (typeof error === "object" && error !== null && "code" in error) {
    if (error.code === "P2002") {
      throw new CurriculumServiceError("semester_order_conflict");
    }
    if (error.code === "P2003") {
      throw new CurriculumServiceError("grade_not_found");
    }
    if (error.code === "P2025") {
      throw new CurriculumServiceError("semester_not_found");
    }
  }

  throw error;
}

export async function createSemester(input: SemesterInput & { gradeId: string }) {
  await requireAdmin();
  const gradeId = input.gradeId.trim();

  if (!gradeId) {
    throw new CurriculumServiceError("invalid_grade_id");
  }

  const data = normalizeSemesterInput(input);
  await requireGrade(gradeId);

  try {
    return await prisma.semester.create({
      data: { gradeId, ...data },
      select: semesterSelect,
    });
  } catch (error) {
    mapSemesterWriteError(error);
  }
}

export async function updateSemester(semesterId: string, input: SemesterInput) {
  await requireAdmin();
  const id = semesterId.trim();
  if (!id) {
    throw new CurriculumServiceError("semester_not_found");
  }

  const data = normalizeSemesterInput(input);
  const semester = await prisma.semester.findUnique({
    where: { id },
    select: { gradeId: true },
  });
  if (!semester) {
    throw new CurriculumServiceError("semester_not_found");
  }
  await requireGrade(semester.gradeId);

  try {
    return await prisma.semester.update({
      where: { id },
      data,
      select: semesterSelect,
    });
  } catch (error) {
    mapSemesterWriteError(error);
  }
}

export async function listCurriculum() {
  await requireAdmin();

  return prisma.grade.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      sortOrder: true,
      semesters: {
        orderBy: [
          { academicYear: "desc" },
          { sortOrder: "asc" },
          { id: "asc" },
        ],
        select: {
          id: true,
          name: true,
          academicYear: true,
          sortOrder: true,
          units: {
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            select: {
              id: true,
              title: true,
              sortOrder: true,
              lessons: {
                orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                select: {
                  id: true,
                  title: true,
                  sortOrder: true,
                },
              },
            },
          },
        },
      },
    },
  });
}
