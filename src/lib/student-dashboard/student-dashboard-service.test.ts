import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), student: vi.fn(), assignments: vi.fn(), assessments: vi.fn(), attempts: vi.fn(), grades: vi.fn(),
}));
vi.mock("@/lib/auth/authorization", () => ({ requireStudent: mocks.auth }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {
  student: { findUnique: mocks.student }, assignment: { findMany: mocks.assignments }, assessment: { findMany: mocks.assessments },
  assessmentAttempt: { findMany: mocks.attempts }, assignmentGrade: { findMany: mocks.grades },
} }));

import { getStudentDashboardData } from "./student-dashboard-service";

const student = (patch: Record<string, unknown> = {}) => ({
  id: "st1", fullName: "سارة أحمد", isActive: true,
  currentSection: { id: "sec1", name: "أ", grade: { id: "g6", name: "الصف السادس" } }, ...patch,
});
const assignment = (patch: Record<string, unknown> = {}) => ({
  id: "hw1", title: "واجب الخلية", externalUrl: "https://example.edu/task", weekNumber: 3,
  lesson: { title: "الخلية" }, grades: [], ...patch,
});
const assessment = (patch: Record<string, unknown> = {}) => ({
  id: "as1", title: "اختبار الخلية", lesson: { title: "الخلية" }, _count: { questions: 4 }, ...patch,
});
const attempt = (patch: Record<string, unknown> = {}) => ({
  id: "at1", score: 4, maxScore: 5, submittedAt: new Date("2026-10-15T10:00:00Z"),
  assessment: { id: "as1", title: "اختبار الخلية" }, ...patch,
});

beforeEach(() => {
  vi.resetAllMocks(); mocks.auth.mockResolvedValue({ id: "user-1" }); mocks.student.mockResolvedValue(student());
  mocks.assignments.mockResolvedValue([]); mocks.assessments.mockResolvedValue([]); mocks.attempts.mockResolvedValue([]); mocks.grades.mockResolvedValue([]);
});

describe("student dashboard profile and scope", () => {
  it("loads the active student's name, section, and grade from the session", async () => {
    const result = await getStudentDashboardData();
    expect(mocks.student).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-1" } }));
    expect(result.student).toEqual({ fullName: "سارة أحمد", section: { id: "sec1", name: "أ" }, grade: { id: "g6", name: "الصف السادس" } });
  });
  it("returns a usable empty dashboard when no section is assigned", async () => {
    mocks.student.mockResolvedValue(student({ currentSection: null }));
    const result = await getStudentDashboardData();
    expect(result.student.grade).toBeNull(); expect(result.assignments).toEqual([]); expect(result.summary.completedAssessments).toBe(0);
    expect(mocks.assignments).not.toHaveBeenCalled();
  });
  it.each([null, student({ isActive: false })])("rejects a missing or inactive student %#", async value => {
    mocks.student.mockResolvedValue(value); await expect(getStudentDashboardData()).rejects.toThrow("ملف الطالبة");
  });
});

describe("student dashboard assignments", () => {
  it("limits latest published external assignments to the current grade and section", async () => {
    mocks.assignments.mockResolvedValue([assignment()]); await getStudentDashboardData();
    const query = mocks.assignments.mock.calls[0][0];
    expect(query.where).toMatchObject({ gradeId: "g6", status: "PUBLISHED", OR: [{ sectionId: null }, { sectionId: "sec1" }] });
    expect(query.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]); expect(query.take).toBe(5);
  });
  it.each([[1, 1], [0, 0], [undefined, null]] as const)("maps assignment grade %s safely", async (score, expected) => {
    mocks.assignments.mockResolvedValue([assignment({ grades: score === undefined ? [] : [{ score }] })]);
    expect((await getStudentDashboardData()).assignments[0].score).toBe(expected);
  });
});

describe("student dashboard assessments and results", () => {
  it("lists only published current-grade assessments without an existing own attempt", async () => {
    mocks.assessments.mockResolvedValue([assessment()]); const result = await getStudentDashboardData();
    expect(result.availableAssessments[0]).toEqual({ id: "as1", title: "اختبار الخلية", lessonTitle: "الخلية", questionCount: 4 });
    expect(mocks.assessments.mock.calls[0][0].where).toMatchObject({ gradeId: "g6", status: "PUBLISHED", attempts: { none: { studentId: "st1" } } });
  });
  it("reads only the current student's graded attempts in latest-first order", async () => {
    mocks.attempts.mockResolvedValue([attempt()]); const result = await getStudentDashboardData();
    expect(result.recentResults[0]).toMatchObject({ score: 4, maxScore: 5, percentage: 80 });
    expect(mocks.attempts.mock.calls[0][0]).toMatchObject({ where: { studentId: "st1", status: "GRADED" }, orderBy: [{ submittedAt: "desc" }, { id: "desc" }] });
  });
  it("keeps only the five latest results while counting all completed attempts", async () => {
    mocks.attempts.mockResolvedValue(Array.from({ length: 6 }, (_, index) => attempt({ id: `at${index}` })));
    const result = await getStudentDashboardData(); expect(result.recentResults).toHaveLength(5); expect(result.summary.completedAssessments).toBe(6);
  });
  it("calculates a zero-safe average of assessment percentages", async () => {
    mocks.attempts.mockResolvedValue([attempt({ score: 1, maxScore: 2 }), attempt({ id: "at2", score: 0, maxScore: 0 })]);
    expect((await getStudentDashboardData()).summary.assessmentAverage).toBe(25);
  });
  it("counts earned assignment points from the student's grades only", async () => {
    mocks.grades.mockResolvedValue([{ score: 1 }, { score: 0 }, { score: 1 }]);
    const result = await getStudentDashboardData();
    expect(result.summary).toMatchObject({ assignmentEarnedPoints: 2, gradedAssignments: 3 });
    expect(mocks.grades.mock.calls[0][0].where.studentId).toBe("st1");
  });
  it("returns a fully zeroed summary without results", async () => {
    expect((await getStudentDashboardData()).summary).toEqual({ completedAssessments: 0, assessmentAverage: 0, assignmentEarnedPoints: 0, gradedAssignments: 0 });
  });
});
