import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const { requireAdminMock, semesterFindUniqueMock, unitFindUniqueMock, unitCreateMock, unitUpdateMock, gradeFindManyMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(), semesterFindUniqueMock: vi.fn(), unitFindUniqueMock: vi.fn(),
  unitCreateMock: vi.fn(), unitUpdateMock: vi.fn(), gradeFindManyMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    grade: { findMany: gradeFindManyMock },
    semester: { findUnique: semesterFindUniqueMock },
    unit: { findUnique: unitFindUniqueMock, create: unitCreateMock, update: unitUpdateMock },
  },
}));
vi.mock("@/lib/auth/authorization", () => ({ requireAdmin: requireAdminMock }));

import { createUnit, updateUnit, listCurriculum } from "./curriculum-service";

const input = { title: "وحدة تجريبية", description: "وصف تجريبي", sortOrder: 1 };
const unit = { id: "unit-1", semesterId: "semester-1", ...input };
const prismaError = (code: string) => new Prisma.PrismaClientKnownRequestError("Database constraint", {
  code, clientVersion: "7.10.0",
});

describe("unit management service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAdminMock.mockResolvedValue(undefined);
    semesterFindUniqueMock.mockResolvedValue({ id: "semester-1" });
    unitFindUniqueMock.mockResolvedValue({ semesterId: "semester-1" });
    unitCreateMock.mockResolvedValue(unit);
    unitUpdateMock.mockResolvedValue(unit);
  });

  it("creates a unit under an existing semester and trims text", async () => {
    expect(await createUnit({ ...input, semesterId: " semester-1 ", title: " وحدة تجريبية ", description: " وصف تجريبي " })).toEqual(unit);
    expect(semesterFindUniqueMock).toHaveBeenCalledWith({ where: { id: "semester-1" }, select: { id: true } });
    expect(unitCreateMock).toHaveBeenCalledWith(expect.objectContaining({ data: { semesterId: "semester-1", ...input } }));
  });

  it("updates only unit fields, preserving the semester and lessons", async () => {
    expect(await updateUnit(" unit-1 ", input)).toEqual(unit);
    expect(unitFindUniqueMock).toHaveBeenCalledWith({ where: { id: "unit-1" }, select: { semesterId: true } });
    expect(unitUpdateMock).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "unit-1" }, data: input }));
  });

  it("allows creation without a description", async () => {
    await createUnit({ semesterId: "semester-1", title: input.title, sortOrder: 1 });
    expect(unitCreateMock.mock.calls[0][0].data).toEqual({ semesterId: "semester-1", title: input.title, sortOrder: 1 });
  });

  it("preserves an existing description when PATCH omits it", async () => {
    await updateUnit("unit-1", { title: input.title, sortOrder: 1 });
    expect(unitUpdateMock.mock.calls[0][0].data).toEqual({ title: input.title, sortOrder: 1 });
  });

  it.each([null, "", "  "])("clears the description when explicitly set to %j", async (description) => {
    await updateUnit("unit-1", { ...input, description });
    expect(unitUpdateMock.mock.calls[0][0].data.description).toBeNull();
  });

  for (const operation of ["create", "update"] as const) {
    describe(operation, () => {
      const save = (fields = input) => operation === "create"
        ? createUnit({ semesterId: "semester-1", ...fields }) : updateUnit("unit-1", fields);
      const writeMock = operation === "create" ? unitCreateMock : unitUpdateMock;

      it("requires admin before any database access", async () => {
        const error = new Error("Access denied");
        requireAdminMock.mockRejectedValue(error);
        await expect(save()).rejects.toBe(error);
        expect(semesterFindUniqueMock).not.toHaveBeenCalled();
        expect(unitFindUniqueMock).not.toHaveBeenCalled();
        expect(writeMock).not.toHaveBeenCalled();
      });

      it.each(["", "  ", "a".repeat(151)])("rejects an invalid title %j", async (title) => {
        await expect(save({ ...input, title })).rejects.toMatchObject({ code: "invalid_unit_title" });
        expect(writeMock).not.toHaveBeenCalled();
      });

      it.each([0, -1, 1.5, NaN, Infinity, 2_147_483_648])("rejects invalid sortOrder %s", async (sortOrder) => {
        await expect(save({ ...input, sortOrder })).rejects.toMatchObject({ code: "invalid_sort_order" });
        expect(writeMock).not.toHaveBeenCalled();
      });

      it("rejects an oversized description", async () => {
        await expect(save({ ...input, description: "a".repeat(5001) })).rejects.toMatchObject({ code: "invalid_unit_description" });
        expect(writeMock).not.toHaveBeenCalled();
      });

      it("rejects a missing semester", async () => {
        semesterFindUniqueMock.mockResolvedValue(null);
        await expect(save()).rejects.toMatchObject({ code: "semester_not_found" });
        expect(writeMock).not.toHaveBeenCalled();
      });

      it("maps P2002 to a unit order conflict", async () => {
        writeMock.mockRejectedValue(prismaError("P2002"));
        await expect(save()).rejects.toMatchObject({ code: "unit_order_conflict" });
      });

      it("handles a semester removed between validation and writing", async () => {
        writeMock.mockRejectedValue(prismaError("P2003"));
        await expect(save()).rejects.toMatchObject({ code: "semester_not_found" });
      });

      it("preserves unexpected database errors", async () => {
        const error = new Error("Database unavailable");
        writeMock.mockRejectedValue(error);
        await expect(save()).rejects.toBe(error);
      });
    });
  }

  it("rejects an empty semesterId", async () => {
    await expect(createUnit({ ...input, semesterId: "  " })).rejects.toMatchObject({ code: "invalid_semester_id" });
    expect(unitCreateMock).not.toHaveBeenCalled();
  });

  it("rejects a missing unit", async () => {
    unitFindUniqueMock.mockResolvedValue(null);
    await expect(updateUnit("missing", input)).rejects.toMatchObject({ code: "unit_not_found" });
    expect(unitUpdateMock).not.toHaveBeenCalled();
  });

  it("rejects an empty unitId", async () => {
    await expect(updateUnit("  ", input)).rejects.toMatchObject({ code: "unit_not_found" });
    expect(unitUpdateMock).not.toHaveBeenCalled();
  });

  it("handles a unit removed during an update", async () => {
    unitUpdateMock.mockRejectedValue(prismaError("P2025"));
    await expect(updateUnit("unit-1", input)).rejects.toMatchObject({ code: "unit_not_found" });
  });

  it("includes unit descriptions in the curriculum read query", async () => {
    gradeFindManyMock.mockResolvedValue([]);
    await listCurriculum();
    expect(gradeFindManyMock.mock.calls[0][0].select.semesters.select.units.select.description).toBe(true);
  });
});
