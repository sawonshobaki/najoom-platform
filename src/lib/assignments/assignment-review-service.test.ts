import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  admin: vi.fn(), assignment: vi.fn(), students: vi.fn(), student: vi.fn(), upsert: vi.fn(),
}));
vi.mock("@/lib/auth/authorization", () => ({ requireAdmin: mocks.admin }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {
  assignment: { findFirst: mocks.assignment },
  student: { findMany: mocks.students, findUnique: mocks.student },
  assignmentGrade: { upsert: mocks.upsert },
} }));

import { listAssignmentReviews, setAssignmentGrade } from "./assignment-review-service";

const assignment = { id: "a1", title: "واجب", description: null, externalUrl: "https://example.edu", weekNumber: 2, gradeId: "g6", lesson: { title: "الخلية" } };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.admin.mockResolvedValue({ id: "admin-1" });
  mocks.assignment.mockResolvedValue(assignment);
  mocks.students.mockResolvedValue([]);
  mocks.student.mockResolvedValue({ id: "st1", isActive: true, currentSection: { gradeId: "g6" } });
  mocks.upsert.mockImplementation(async ({ create, update }: { create: { score: number }; update: { score: number } }) => ({ score: create?.score ?? update.score, gradedAt: new Date("2026-10-15") }));
});

describe("setAssignmentGrade", () => {
  it.each([1, 0] as const)("stores score %s with reviewer-owned metadata", async score => {
    await setAssignmentGrade({ assignmentId: "a1", studentId: "st1", score });
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { assignmentId_studentId: { assignmentId: "a1", studentId: "st1" } },
      create: expect.objectContaining({ assignmentId: "a1", studentId: "st1", submissionId: null, score, gradedById: "admin-1" }),
      update: expect.objectContaining({ score, gradedById: "admin-1" }),
    }));
  });
  it.each([2, -1, 0.5])("rejects invalid score %s before writing", async score => {
    await expect(setAssignmentGrade({ assignmentId: "a1", studentId: "st1", score })).rejects.toThrow("0 أو 1");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("rejects a missing assignment", async () => { mocks.assignment.mockResolvedValue(null); await expect(setAssignmentGrade({ assignmentId: "x", studentId: "st1", score: 1 })).rejects.toMatchObject({ code: "assignment_not_found" }); });
  it("rejects a missing student", async () => { mocks.student.mockResolvedValue(null); await expect(setAssignmentGrade({ assignmentId: "a1", studentId: "x", score: 1 })).rejects.toMatchObject({ code: "student_not_found" }); });
  it.each([
    { id: "st1", isActive: false, currentSection: { gradeId: "g6" } },
    { id: "st1", isActive: true, currentSection: { gradeId: "g5" } },
    { id: "st1", isActive: true, currentSection: null },
  ])("rejects inactive, unassigned, or wrong-grade students %#", async student => {
    mocks.student.mockResolvedValue(student);
    await expect(setAssignmentGrade({ assignmentId: "a1", studentId: "st1", score: 1 })).rejects.toMatchObject({ code: "student_not_eligible" });
  });
  it("updates the same compound key instead of creating duplicates", async () => {
    await setAssignmentGrade({ assignmentId: "a1", studentId: "st1", score: 1 });
    await setAssignmentGrade({ assignmentId: "a1", studentId: "st1", score: 0 });
    expect(mocks.upsert).toHaveBeenCalledTimes(2);
    expect(mocks.upsert.mock.calls[1][0].where).toEqual({ assignmentId_studentId: { assignmentId: "a1", studentId: "st1" } });
  });
  it("keeps students and weekly assignments on distinct compound keys", async () => {
    await setAssignmentGrade({ assignmentId: "a1", studentId: "st1", score: 1 });
    await setAssignmentGrade({ assignmentId: "a1", studentId: "st2", score: 0 });
    await setAssignmentGrade({ assignmentId: "a2", studentId: "st1", score: 0 });
    expect(mocks.upsert.mock.calls.map(call => call[0].where.assignmentId_studentId)).toEqual([
      { assignmentId: "a1", studentId: "st1" }, { assignmentId: "a1", studentId: "st2" }, { assignmentId: "a2", studentId: "st1" },
    ]);
  });
});

describe("listAssignmentReviews", () => {
  it("returns active students from the assignment grade with their current score", async () => {
    mocks.students.mockResolvedValue([{ id: "st1", fullName: "سارة", currentSection: { id: "sec1", name: "أ" }, assignmentGrades: [{ score: 0, gradedAt: new Date("2026-10-15") }] }]);
    const result = await listAssignmentReviews("a1");
    expect(result.students[0]).toMatchObject({ fullName: "سارة", sectionName: "أ", score: 0 });
    expect(mocks.students.mock.calls[0][0].where).toEqual({ isActive: true, currentSection: { gradeId: "g6" } });
    expect(mocks.students.mock.calls[0][0].select.assignmentGrades.where).toEqual({ assignmentId: "a1" });
  });
  it("marks an ungraded student without exposing internal relations", async () => {
    mocks.students.mockResolvedValue([{ id: "st1", fullName: "سارة", currentSection: { id: "sec1", name: "أ" }, assignmentGrades: [] }]);
    expect((await listAssignmentReviews("a1")).students[0]).toEqual({ id: "st1", fullName: "سارة", sectionName: "أ", score: null, gradedAt: null });
  });
});
