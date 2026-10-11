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
              description: true,
              sortOrder: true,
              lessons: {
                orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                select: {
                  id: true,
                  title: true,
                  description: true,
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

export type UnitServiceErrorCode =
  | "invalid_request_body"
  | "invalid_semester_id"
  | "semester_not_found"
  | "invalid_unit_title"
  | "invalid_unit_description"
  | "invalid_sort_order"
  | "unit_not_found"
  | "unit_order_conflict";

export class UnitServiceError extends Error {
  constructor(public readonly code: UnitServiceErrorCode) {
    super(code);
    this.name = "UnitServiceError";
  }
}

export type UnitInput = {
  title: string;
  description?: string | null;
  sortOrder: number;
};

const unitSelect = {
  id: true,
  semesterId: true,
  title: true,
  description: true,
  sortOrder: true,
} as const;

function normalizeUnitInput(input: UnitInput) {
  const title = input.title.trim();
  if (!title || title.length > 150) {
    throw new UnitServiceError("invalid_unit_title");
  }
  if (input.description !== undefined && input.description !== null && typeof input.description !== "string") {
    throw new UnitServiceError("invalid_unit_description");
  }
  const description = input.description?.trim() || null;
  if (description && description.length > 5000) {
    throw new UnitServiceError("invalid_unit_description");
  }
  if (!Number.isInteger(input.sortOrder) || input.sortOrder < 1 || input.sortOrder > 2_147_483_647) {
    throw new UnitServiceError("invalid_sort_order");
  }
  // الوصف المحذوف من PATCH يبقى كما هو؛ null أو النص الفارغ يمسحانه.
  return {
    title,
    sortOrder: input.sortOrder,
    ...(input.description !== undefined ? { description } : {}),
  };
}

async function requireSemester(semesterId: string) {
  const semester = await prisma.semester.findUnique({
    where: { id: semesterId },
    select: { id: true },
  });
  if (!semester) {
    throw new UnitServiceError("semester_not_found");
  }
}

function mapUnitWriteError(error: unknown): never {
  if (typeof error === "object" && error !== null && "code" in error) {
    if (error.code === "P2002") throw new UnitServiceError("unit_order_conflict");
    if (error.code === "P2003") throw new UnitServiceError("semester_not_found");
    if (error.code === "P2025") throw new UnitServiceError("unit_not_found");
  }
  throw error;
}

export async function createUnit(input: UnitInput & { semesterId: string }) {
  await requireAdmin();
  const semesterId = input.semesterId.trim();
  if (!semesterId) throw new UnitServiceError("invalid_semester_id");
  const data = normalizeUnitInput(input);
  await requireSemester(semesterId);

  try {
    return await prisma.unit.create({
      data: { semesterId, ...data },
      select: unitSelect,
    });
  } catch (error) {
    mapUnitWriteError(error);
  }
}

export async function updateUnit(unitId: string, input: UnitInput) {
  await requireAdmin();
  const id = unitId.trim();
  if (!id) throw new UnitServiceError("unit_not_found");
  const data = normalizeUnitInput(input);
  const unit = await prisma.unit.findUnique({
    where: { id },
    select: { semesterId: true },
  });
  if (!unit) throw new UnitServiceError("unit_not_found");
  await requireSemester(unit.semesterId);

  try {
    return await prisma.unit.update({
      where: { id },
      data,
      select: unitSelect,
    });
  } catch (error) {
    mapUnitWriteError(error);
  }
}

export type LessonServiceErrorCode =
  | "invalid_request_body"
  | "invalid_unit_id"
  | "unit_not_found"
  | "invalid_lesson_title"
  | "invalid_lesson_description"
  | "invalid_sort_order"
  | "lesson_not_found"
  | "lesson_order_conflict";

export class LessonServiceError extends Error {
  constructor(public readonly code: LessonServiceErrorCode) {
    super(code);
    this.name = "LessonServiceError";
  }
}

export type LessonInput = {
  title: string;
  description?: string | null;
  sortOrder: number;
};

const lessonSelect = {
  id: true,
  unitId: true,
  title: true,
  description: true,
  sortOrder: true,
} as const;

function normalizeLessonInput(input: LessonInput) {
  const title = input.title.trim();
  if (!title || title.length > 150) {
    throw new LessonServiceError("invalid_lesson_title");
  }
  if (input.description !== undefined && input.description !== null && typeof input.description !== "string") {
    throw new LessonServiceError("invalid_lesson_description");
  }
  const description = input.description?.trim() || null;
  if (description && description.length > 5000) {
    throw new LessonServiceError("invalid_lesson_description");
  }
  if (!Number.isInteger(input.sortOrder) || input.sortOrder < 1 || input.sortOrder > 2_147_483_647) {
    throw new LessonServiceError("invalid_sort_order");
  }
  // الوصف المحذوف من PATCH يبقى كما هو؛ null أو النص الفارغ يمسحانه.
  return {
    title,
    sortOrder: input.sortOrder,
    ...(input.description !== undefined ? { description } : {}),
  };
}

async function requireUnit(unitId: string) {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: { id: true },
  });
  if (!unit) {
    throw new LessonServiceError("unit_not_found");
  }
}

function mapLessonWriteError(error: unknown): never {
  if (typeof error === "object" && error !== null && "code" in error) {
    if (error.code === "P2002") throw new LessonServiceError("lesson_order_conflict");
    if (error.code === "P2003") throw new LessonServiceError("unit_not_found");
    if (error.code === "P2025") throw new LessonServiceError("lesson_not_found");
  }
  throw error;
}

export async function createLesson(input: LessonInput & { unitId: string }) {
  await requireAdmin();
  const unitId = input.unitId.trim();
  if (!unitId) throw new LessonServiceError("invalid_unit_id");
  const data = normalizeLessonInput(input);
  await requireUnit(unitId);

  try {
    return await prisma.lesson.create({
      data: { unitId, ...data },
      select: lessonSelect,
    });
  } catch (error) {
    mapLessonWriteError(error);
  }
}

export async function updateLesson(lessonId: string, input: LessonInput) {
  await requireAdmin();
  const id = lessonId.trim();
  if (!id) throw new LessonServiceError("lesson_not_found");
  const data = normalizeLessonInput(input);
  const lesson = await prisma.lesson.findUnique({
    where: { id },
    select: { unitId: true },
  });
  if (!lesson) throw new LessonServiceError("lesson_not_found");
  await requireUnit(lesson.unitId);

  try {
    return await prisma.lesson.update({
      where: { id },
      data,
      select: lessonSelect,
    });
  } catch (error) {
    mapLessonWriteError(error);
  }
}
