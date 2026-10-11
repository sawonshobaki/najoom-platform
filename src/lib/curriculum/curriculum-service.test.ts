import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const {
  gradeFindManyMock, gradeFindUniqueMock, requireAdminMock,
  semesterFindUniqueMock, semesterCreateMock, semesterUpdateMock,
} = vi.hoisted(() => ({
  gradeFindManyMock: vi.fn(),
  gradeFindUniqueMock: vi.fn(),
  requireAdminMock: vi.fn(),
  semesterFindUniqueMock: vi.fn(),
  semesterCreateMock: vi.fn(),
  semesterUpdateMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    grade: { findMany: gradeFindManyMock, findUnique: gradeFindUniqueMock },
    semester: {
      findUnique: semesterFindUniqueMock,
      create: semesterCreateMock,
      update: semesterUpdateMock,
    },
  },
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAdmin: requireAdminMock,
}));

import { createSemester, updateSemester, listCurriculum } from "./curriculum-service";

describe("listCurriculum", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAdminMock.mockResolvedValue(undefined);
    gradeFindManyMock.mockResolvedValue([]);
  });

  it("reads the hierarchy with explicit ordering at every level", async () => {
    const grades = [{
      id: "grade-1",
      name: "صف تجريبي",
      sortOrder: 1,
      semesters: [{
        id: "semester-1",
        name: "فصل تجريبي",
        academicYear: "2026-2027",
        sortOrder: 1,
        units: [{
          id: "unit-1",
          title: "وحدة تجريبية",
          sortOrder: 1,
          lessons: [{ id: "lesson-1", title: "درس تجريبي", sortOrder: 1 }],
        }],
      }],
    }];
    gradeFindManyMock.mockResolvedValue(grades);

    expect(await listCurriculum()).toEqual(grades);
    expect(requireAdminMock).toHaveBeenCalledTimes(1);
    expect(gradeFindManyMock).toHaveBeenCalledTimes(1);

    const query = gradeFindManyMock.mock.calls[0][0];
    expect(query.orderBy).toEqual([{ sortOrder: "asc" }, { id: "asc" }]);
    const semesters = query.select.semesters;
    expect(semesters.orderBy).toEqual([
      { academicYear: "desc" }, { sortOrder: "asc" }, { id: "asc" },
    ]);
    const units = semesters.select.units;
    expect(units.orderBy).toEqual([{ sortOrder: "asc" }, { id: "asc" }]);
    expect(units.select.lessons.orderBy).toEqual([
      { sortOrder: "asc" }, { id: "asc" },
    ]);
    expect(query.where).toBeUndefined();
    expect(query.select.sections).toBeUndefined();
    expect(units.select.lessons.select).toEqual({
      id: true, title: true, description: true, sortOrder: true,
      concepts: { select: { id: true, title: true, description: true } },
      learningObjectives: { select: { id: true, title: true, description: true,
        skills: { select: { skill: { select: { id: true, name: true, description: true } } } },
      } },
    });
  });

  it("returns an empty list when no grades exist", async () => {
    expect(await listCurriculum()).toEqual([]);
  });

  it("preserves grades and branches that have no curriculum children", async () => {
    const grades = [
      { id: "grade-1", name: "صف تجريبي", sortOrder: 1, semesters: [] },
      {
        id: "grade-2", name: "صف آخر", sortOrder: 2,
        semesters: [
          { id: "semester-1", name: "فصل فارغ", academicYear: "2026-2027", sortOrder: 1, units: [] },
          {
            id: "semester-2", name: "فصل آخر", academicYear: "2026-2027", sortOrder: 2,
            units: [{ id: "unit-1", title: "وحدة فارغة", sortOrder: 1, lessons: [] }],
          },
        ],
      },
    ];
    gradeFindManyMock.mockResolvedValue(grades);

    expect(await listCurriculum()).toEqual(grades);
  });

  it("does not query the database when admin authorization fails", async () => {
    const error = new Error("Access denied");
    requireAdminMock.mockRejectedValue(error);

    await expect(listCurriculum()).rejects.toBe(error);
    expect(gradeFindManyMock).not.toHaveBeenCalled();
  });

  it("does not report a database failure as an empty curriculum", async () => {
    const error = new Error("Database unavailable");
    gradeFindManyMock.mockRejectedValue(error);

    await expect(listCurriculum()).rejects.toBe(error);
  });
});

const semesterInput = { name: "الفصل الأول", academicYear: "2026-2027", sortOrder: 1 };
const savedSemester = { id: "semester-1", gradeId: "grade-1", ...semesterInput };

describe("semester management service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAdminMock.mockResolvedValue(undefined);
    gradeFindUniqueMock.mockResolvedValue({ id: "grade-1" });
    semesterFindUniqueMock.mockResolvedValue({ gradeId: "grade-1" });
    semesterCreateMock.mockResolvedValue(savedSemester);
    semesterUpdateMock.mockResolvedValue(savedSemester);
  });

  it("creates a semester under an existing grade and normalizes text", async () => {
    expect(await createSemester({
      ...semesterInput, gradeId: " grade-1 ", name: " الفصل الأول ", academicYear: " 2026-2027 ",
    })).toEqual(savedSemester);
    expect(requireAdminMock).toHaveBeenCalledTimes(1);
    expect(gradeFindUniqueMock).toHaveBeenCalledWith({ where: { id: "grade-1" }, select: { id: true } });
    expect(semesterCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: { gradeId: "grade-1", ...semesterInput },
    }));
  });

  it("updates semester fields without changing the grade or its units", async () => {
    expect(await updateSemester(" semester-1 ", {
      ...semesterInput, name: " الفصل الأول ", academicYear: " 2026-2027 ",
    })).toEqual(savedSemester);
    expect(semesterUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "semester-1" }, data: semesterInput,
    }));
    expect(gradeFindUniqueMock).toHaveBeenCalledTimes(1);
  });

  for (const operation of ["create", "update"] as const) {
    describe(operation, () => {
      const save = (input = semesterInput) => operation === "create"
        ? createSemester({ gradeId: "grade-1", ...input }) : updateSemester("semester-1", input);
      const writeMock = operation === "create" ? semesterCreateMock : semesterUpdateMock;

      it("checks admin authorization before reading or writing the database", async () => {
        const error = new Error("Access denied");
        requireAdminMock.mockRejectedValue(error);
        await expect(save()).rejects.toBe(error);
        expect(gradeFindUniqueMock).not.toHaveBeenCalled();
        expect(semesterFindUniqueMock).not.toHaveBeenCalled();
        expect(writeMock).not.toHaveBeenCalled();
      });

      it.each(["", "2026/2027", "2026-2028", "2027-2026", "26-27", "2026-2027extra", "٢٠٢٦-٢٠٢٧"])(
        "rejects invalid academicYear %j", async (academicYear) => {
          await expect(save({ ...semesterInput, academicYear })).rejects.toMatchObject({ code: "invalid_academic_year" });
          expect(writeMock).not.toHaveBeenCalled();
        },
      );

      it.each([0, -1, 1.5, NaN, Infinity, 2_147_483_648])("rejects invalid sortOrder %s", async (sortOrder) => {
        await expect(save({ ...semesterInput, sortOrder })).rejects.toMatchObject({ code: "invalid_sort_order" });
        expect(writeMock).not.toHaveBeenCalled();
      });

      it.each(["", "   ", "a".repeat(101)])("rejects invalid name %j", async (name) => {
        await expect(save({ ...semesterInput, name })).rejects.toMatchObject({ code: "invalid_semester_name" });
        expect(writeMock).not.toHaveBeenCalled();
      });

      it("rejects a missing grade", async () => {
        gradeFindUniqueMock.mockResolvedValue(null);
        await expect(save()).rejects.toMatchObject({ code: "grade_not_found" });
        expect(writeMock).not.toHaveBeenCalled();
      });

      it("maps P2002 from the database constraint to an order conflict", async () => {
        writeMock.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("Unique constraint", {
          code: "P2002", clientVersion: "7.10.0", meta: { target: ["gradeId", "academicYear", "sortOrder"] },
        }));
        await expect(save()).rejects.toMatchObject({ code: "semester_order_conflict" });
      });

      it("handles a grade removed between validation and writing", async () => {
        writeMock.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("Foreign key constraint", {
          code: "P2003", clientVersion: "7.10.0",
        }));
        await expect(save()).rejects.toMatchObject({ code: "grade_not_found" });
      });

      it("preserves unexpected database errors", async () => {
        const error = new Error("Database unavailable");
        writeMock.mockRejectedValue(error);
        await expect(save()).rejects.toBe(error);
      });
    });
  }

  it("rejects an empty gradeId", async () => {
    await expect(createSemester({ ...semesterInput, gradeId: "  " })).rejects.toMatchObject({ code: "invalid_grade_id" });
    expect(semesterCreateMock).not.toHaveBeenCalled();
  });

  it("rejects a semester that does not exist", async () => {
    semesterFindUniqueMock.mockResolvedValue(null);
    await expect(updateSemester("missing", semesterInput)).rejects.toMatchObject({ code: "semester_not_found" });
    expect(semesterUpdateMock).not.toHaveBeenCalled();
  });

  it("handles concurrent removal of the semester during an update", async () => {
    semesterUpdateMock.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("Record not found", {
      code: "P2025", clientVersion: "7.10.0",
    }));
    await expect(updateSemester("semester-1", semesterInput)).rejects.toMatchObject({ code: "semester_not_found" });
  });
});
