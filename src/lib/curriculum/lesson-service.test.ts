import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const { requireAdminMock, unitFindUniqueMock, lessonFindUniqueMock, lessonCreateMock, lessonUpdateMock, gradeFindManyMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(), unitFindUniqueMock: vi.fn(), lessonFindUniqueMock: vi.fn(),
  lessonCreateMock: vi.fn(), lessonUpdateMock: vi.fn(), gradeFindManyMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    grade: { findMany: gradeFindManyMock },
    unit: { findUnique: unitFindUniqueMock },
    lesson: { findUnique: lessonFindUniqueMock, create: lessonCreateMock, update: lessonUpdateMock },
  },
}));
vi.mock("@/lib/auth/authorization", () => ({ requireAdmin: requireAdminMock }));

import { createLesson, updateLesson, listCurriculum } from "./curriculum-service";

const input = { title: "درس تجريبي", description: "وصف تجريبي", sortOrder: 1 };
const lesson = { id: "lesson-1", unitId: "unit-1", ...input };
const prismaError = (code: string) => new Prisma.PrismaClientKnownRequestError("Database constraint", {
  code, clientVersion: "7.10.0",
});

describe("lesson management service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAdminMock.mockResolvedValue(undefined);
    unitFindUniqueMock.mockResolvedValue({ id: "unit-1" });
    lessonFindUniqueMock.mockResolvedValue({ unitId: "unit-1" });
    lessonCreateMock.mockResolvedValue(lesson);
    lessonUpdateMock.mockResolvedValue(lesson);
  });

  it("creates a lesson under an existing unit and trims text", async () => {
    expect(await createLesson({ ...input, unitId: " unit-1 ", title: " درس تجريبي ", description: " وصف تجريبي " })).toEqual(lesson);
    expect(unitFindUniqueMock).toHaveBeenCalledWith({ where: { id: "unit-1" }, select: { id: true } });
    expect(lessonCreateMock).toHaveBeenCalledWith(expect.objectContaining({ data: { unitId: "unit-1", ...input } }));
  });

  it("updates only lesson fields, preserving the unit and related data", async () => {
    expect(await updateLesson(" lesson-1 ", input)).toEqual(lesson);
    expect(lessonFindUniqueMock).toHaveBeenCalledWith({ where: { id: "lesson-1" }, select: { unitId: true } });
    expect(lessonUpdateMock).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "lesson-1" }, data: input }));
  });

  it("allows creation without a description", async () => {
    await createLesson({ unitId: "unit-1", title: input.title, sortOrder: 1 });
    expect(lessonCreateMock.mock.calls[0][0].data).toEqual({ unitId: "unit-1", title: input.title, sortOrder: 1 });
  });

  it("preserves an existing description when PATCH omits it", async () => {
    await updateLesson("lesson-1", { title: input.title, sortOrder: 1 });
    expect(lessonUpdateMock.mock.calls[0][0].data).toEqual({ title: input.title, sortOrder: 1 });
  });

  it.each([null, "", "  "])("clears the description when explicitly set to %j", async (description) => {
    await updateLesson("lesson-1", { ...input, description });
    expect(lessonUpdateMock.mock.calls[0][0].data.description).toBeNull();
  });

  for (const operation of ["create", "update"] as const) {
    describe(operation, () => {
      const save = (fields = input) => operation === "create"
        ? createLesson({ unitId: "unit-1", ...fields }) : updateLesson("lesson-1", fields);
      const writeMock = operation === "create" ? lessonCreateMock : lessonUpdateMock;

      it("requires admin before any database access", async () => {
        const error = new Error("Access denied");
        requireAdminMock.mockRejectedValue(error);
        await expect(save()).rejects.toBe(error);
        expect(unitFindUniqueMock).not.toHaveBeenCalled();
        expect(lessonFindUniqueMock).not.toHaveBeenCalled();
        expect(writeMock).not.toHaveBeenCalled();
      });

      it.each(["", "  ", "a".repeat(151)])("rejects an invalid title %j", async (title) => {
        await expect(save({ ...input, title })).rejects.toMatchObject({ code: "invalid_lesson_title" });
        expect(writeMock).not.toHaveBeenCalled();
      });

      it.each([0, -1, 1.5, NaN, Infinity, 2_147_483_648])("rejects invalid sortOrder %s", async (sortOrder) => {
        await expect(save({ ...input, sortOrder })).rejects.toMatchObject({ code: "invalid_sort_order" });
        expect(writeMock).not.toHaveBeenCalled();
      });

      it("rejects an oversized description", async () => {
        await expect(save({ ...input, description: "a".repeat(5001) })).rejects.toMatchObject({ code: "invalid_lesson_description" });
        expect(writeMock).not.toHaveBeenCalled();
      });

      it("rejects a missing unit", async () => {
        unitFindUniqueMock.mockResolvedValue(null);
        await expect(save()).rejects.toMatchObject({ code: "unit_not_found" });
        expect(writeMock).not.toHaveBeenCalled();
      });

      it("maps P2002 to a lesson order conflict", async () => {
        writeMock.mockRejectedValue(prismaError("P2002"));
        await expect(save()).rejects.toMatchObject({ code: "lesson_order_conflict" });
      });

      it("handles a unit removed between validation and writing", async () => {
        writeMock.mockRejectedValue(prismaError("P2003"));
        await expect(save()).rejects.toMatchObject({ code: "unit_not_found" });
      });

      it("preserves unexpected database errors", async () => {
        const error = new Error("Database unavailable");
        writeMock.mockRejectedValue(error);
        await expect(save()).rejects.toBe(error);
      });
    });
  }

  it("rejects an empty unitId", async () => {
    await expect(createLesson({ ...input, unitId: "  " })).rejects.toMatchObject({ code: "invalid_unit_id" });
    expect(lessonCreateMock).not.toHaveBeenCalled();
  });

  it("rejects a missing lesson", async () => {
    lessonFindUniqueMock.mockResolvedValue(null);
    await expect(updateLesson("missing", input)).rejects.toMatchObject({ code: "lesson_not_found" });
    expect(lessonUpdateMock).not.toHaveBeenCalled();
  });

  it("rejects an empty lessonId", async () => {
    await expect(updateLesson("  ", input)).rejects.toMatchObject({ code: "lesson_not_found" });
    expect(lessonUpdateMock).not.toHaveBeenCalled();
  });

  it("handles a lesson removed during an update", async () => {
    lessonUpdateMock.mockRejectedValue(prismaError("P2025"));
    await expect(updateLesson("lesson-1", input)).rejects.toMatchObject({ code: "lesson_not_found" });
  });

  it("includes lesson descriptions in the curriculum read query", async () => {
    gradeFindManyMock.mockResolvedValue([]);
    await listCurriculum();
    expect(gradeFindManyMock.mock.calls[0][0].select.semesters.select.units.select.lessons.select.description).toBe(true);
  });
});
