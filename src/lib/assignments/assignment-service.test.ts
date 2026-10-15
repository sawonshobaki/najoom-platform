import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), studentAuth: vi.fn(), list: vi.fn(), get: vi.fn(), create: vi.fn(), lesson: vi.fn(), grades: vi.fn(), student: vi.fn() }));
vi.mock("@/lib/auth/authorization", () => ({ requireAdmin: mocks.admin, requireStudent: mocks.studentAuth }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { assignment: { findMany: mocks.list, findFirst: mocks.get, create: mocks.create }, lesson: { findUnique: mocks.lesson }, grade: { findMany: mocks.grades }, student: { findUnique: mocks.student } } }));
import { createAssignment, getAssignment, getAssignmentCreationData, listAssignments, listStudentAssignments } from "./assignment-service";

const row = (patch: Record<string, unknown> = {}) => ({ id: "a1", title: "واجب", description: null, externalUrl: "https://example.edu/task", weekNumber: 1, createdAt: new Date("2026-10-15T00:00:00Z"), lesson: { id: "l1", title: "الخلية", unit: { id: "u1", title: "الوحدة", semester: { id: "s1", name: "الفصل الأول", academicYear: "2026-2027", grade: { id: "g6", name: "الصف السادس" } } } }, ...patch });
const input = (patch: Record<string, unknown> = {}) => ({ lessonId: "l1", title: "واجب", description: null, externalUrl: "https://example.edu/task", weekNumber: 1, ...patch });
beforeEach(() => { vi.resetAllMocks(); mocks.admin.mockResolvedValue({ id: "admin-1" }); mocks.studentAuth.mockResolvedValue({ id: "user-1" }); mocks.list.mockResolvedValue([]); mocks.get.mockResolvedValue(row()); mocks.create.mockResolvedValue(row()); mocks.lesson.mockResolvedValue({ id: "l1", unit: { semester: { gradeId: "g6" } } }); mocks.grades.mockResolvedValue([]); mocks.student.mockResolvedValue({ id: "st1", isActive: true, currentSectionId: "sec1", currentSection: { gradeId: "g6" } }); });

describe("createAssignment", () => {
  it("creates a published external assignment with server-owned metadata", async () => { await createAssignment(input()); expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ data: { lessonId: "l1", gradeId: "g6", sectionId: null, title: "واجب", description: null, externalUrl: "https://example.edu/task", weekNumber: 1, prompt: null, maxScore: null, dueAt: null, status: "PUBLISHED", createdById: "admin-1" } })); });
  it("creates with trimmed instructions", async () => { mocks.create.mockResolvedValue(row({ description: "نفّذي النشاط" })); await createAssignment(input({ description: " نفّذي النشاط " })); expect(mocks.create.mock.calls[0][0].data.description).toBe("نفّذي النشاط"); });
  it("derives the grade from the selected lesson", async () => { await createAssignment(input()); expect(mocks.lesson).toHaveBeenCalledWith({ where: { id: "l1" }, select: { id: true, unit: { select: { semester: { select: { gradeId: true } } } } } }); });
  it("rejects a missing lesson", async () => { mocks.lesson.mockResolvedValue(null); await expect(createAssignment(input())).rejects.toMatchObject({ code: "lesson_not_found" }); expect(mocks.create).not.toHaveBeenCalled(); });
  it("uses the authenticated admin before validation", async () => { mocks.admin.mockRejectedValue(new Error("forbidden")); await expect(createAssignment(null)).rejects.toThrow("forbidden"); expect(mocks.create).not.toHaveBeenCalled(); });
});

describe("assignment reads", () => {
  it("returns an empty archive with weekly ordering", async () => { expect(await listAssignments()).toEqual([]); expect(mocks.list.mock.calls[0][0].orderBy).toEqual([{ weekNumber: "desc" }, { createdAt: "desc" }, { id: "desc" }]); });
  it("preserves multiple assignments from the same and different weeks", async () => { mocks.list.mockResolvedValue([row({ id: "w2", weekNumber: 2 }), row({ id: "w1b" }), row({ id: "w1a" })]); expect((await listAssignments()).map(item => item.id)).toEqual(["w2", "w1b", "w1a"]); });
  it("gets an external assignment and rejects missing or legacy records", async () => { await expect(getAssignment(" a1 ")).resolves.toMatchObject({ id: "a1" }); mocks.get.mockResolvedValue(null); await expect(getAssignment("missing")).rejects.toMatchObject({ code: "assignment_not_found" }); });
  it("loads ordered curriculum for the form", async () => { await expect(getAssignmentCreationData()).resolves.toEqual([]); expect(mocks.grades.mock.calls[0][0].orderBy).toEqual([{ sortOrder: "asc" }, { id: "asc" }]); });
});

describe("student assignment archive", () => {
  it("filters published external assignments by the student's current grade and section", async () => { mocks.list.mockResolvedValue([row()]); expect(await listStudentAssignments()).toHaveLength(1); expect(mocks.list.mock.calls[0][0].where).toMatchObject({ gradeId: "g6", status: "PUBLISHED", OR: [{ sectionId: null }, { sectionId: "sec1" }] }); });
  it("returns empty when the student has no current section", async () => { mocks.student.mockResolvedValue({ id: "st1", isActive: true, currentSectionId: null, currentSection: null }); expect(await listStudentAssignments()).toEqual([]); expect(mocks.list).not.toHaveBeenCalled(); });
  it("rejects an inactive or missing student profile", async () => { mocks.student.mockResolvedValue({ id: "st1", isActive: false }); await expect(listStudentAssignments()).rejects.toMatchObject({ code: "student_not_found" }); });
});
