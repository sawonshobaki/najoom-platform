import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), get: vi.fn() }));
vi.mock("@/lib/auth/authorization", () => ({ requireAdmin: mocks.auth }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { assessment: { findUnique: mocks.get } } }));
import { getAssessmentResults } from "./assessment-results-service";

const assessment = (attempts: Record<string, unknown>[] = []) => ({
  id: "a1", title: "اختبار الخلية", status: "PUBLISHED", lesson: { id: "l1", title: "الخلية" },
  questions: [{ pointsOverride: null, question: { points: 2 } }, { pointsOverride: 3, question: { points: 1 } }], attempts,
});
const attempt = (patch: Record<string, unknown> = {}) => ({ id: "t1", status: "GRADED", startedAt: new Date("2026-10-15T00:00:00Z"),
  submittedAt: new Date("2026-10-15T00:05:00Z"), score: 4, maxScore: 5, student: { id: "s1", fullName: "سارة أحمد" }, ...patch });

beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ id: "admin" }); mocks.get.mockResolvedValue(assessment()); });

describe("getAssessmentResults", () => {
  it("returns an empty safe summary", async () => {
    expect(await getAssessmentResults(" a1 ")).toMatchObject({ totalAttempts: 0, gradedAttempts: 0, averageScore: null, averagePercentage: null, questionCount: 2, maxScore: 5, attempts: [] });
  });
  it("calculates one graded attempt", async () => {
    mocks.get.mockResolvedValue(assessment([attempt()]));
    const result = await getAssessmentResults("a1");
    expect(result).toMatchObject({ totalAttempts: 1, gradedAttempts: 1, averageScore: 4, averagePercentage: 80 });
    expect(result.attempts[0]).toMatchObject({ score: 4, maxScore: 5, percentage: 80, student: { fullName: "سارة أحمد" } });
  });
  it("calculates averages from graded attempts only", async () => {
    mocks.get.mockResolvedValue(assessment([attempt(), attempt({ id: "t2", score: 1, maxScore: 4, student: { id: "s2", fullName: "ليان" } }), attempt({ id: "t3", status: "IN_PROGRESS", score: null, maxScore: null, submittedAt: null })]));
    expect(await getAssessmentResults("a1")).toMatchObject({ totalAttempts: 3, gradedAttempts: 2, averageScore: 2.5, averagePercentage: 52.5 });
  });
  it("does not select answers, snapshots, or answer keys", async () => {
    await getAssessmentResults("a1");
    const select = mocks.get.mock.calls[0][0].select;
    expect(JSON.stringify(select)).not.toMatch(/answer|questionSnapshot|isCorrect/);
  });
  it("requires admin and hides missing assessments", async () => {
    mocks.auth.mockRejectedValue(new Error("forbidden")); await expect(getAssessmentResults("a1")).rejects.toThrow("forbidden");
    mocks.auth.mockResolvedValue({ id: "admin" }); mocks.get.mockResolvedValue(null);
    await expect(getAssessmentResults("missing")).rejects.toMatchObject({ code: "assessment_not_found" });
  });
});
