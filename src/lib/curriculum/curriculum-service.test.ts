import { beforeEach, describe, expect, it, vi } from "vitest";

const { gradeFindManyMock, requireAdminMock } = vi.hoisted(() => ({
  gradeFindManyMock: vi.fn(),
  requireAdminMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: { grade: { findMany: gradeFindManyMock } },
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAdmin: requireAdminMock,
}));

import { listCurriculum } from "./curriculum-service";

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
      id: true, title: true, sortOrder: true,
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
