import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ start: vi.fn(), save: vi.fn(), submit: vi.fn() }));
vi.mock("@/lib/auth/authorization", () => ({
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {}, AuthorizationDeniedError: class AuthorizationDeniedError extends Error {},
}));
vi.mock("@/lib/assessments/attempt-service", () => ({
  AttemptServiceError: class AttemptServiceError extends Error { constructor(public code: string) { super(code); } },
  startAssessmentAttempt: mocks.start, saveAssessmentAnswer: mocks.save, submitAssessmentAttempt: mocks.submit,
}));
import { AuthenticationRequiredError, AuthorizationDeniedError } from "@/lib/auth/authorization";
import { AttemptServiceError } from "@/lib/assessments/attempt-service";
import { POST as startRoute } from "../assessments/[assessmentId]/attempts/route";
import { PUT as answerRoute } from "./[attemptId]/answers/[assessmentQuestionId]/route";
import { POST as submitRoute } from "./[attemptId]/submit/route";

const start = () => startRoute(new Request("http://localhost/api/student/assessments/a1/attempts", { method: "POST" }), { params: Promise.resolve({ assessmentId: "a1" }) });
const answer = (body: string | object = { optionId: "o1" }) => answerRoute(new Request("http://localhost/api/student/assessment-attempts/t1/answers/aq1", { method: "PUT", body: typeof body === "string" ? body : JSON.stringify(body) }), { params: Promise.resolve({ attemptId: "t1", assessmentQuestionId: "aq1" }) });
const submit = () => submitRoute(new Request("http://localhost/api/student/assessment-attempts/t1/submit", { method: "POST" }), { params: Promise.resolve({ attemptId: "t1" }) });

beforeEach(() => {
  vi.resetAllMocks(); mocks.start.mockResolvedValue({ attemptId: "t1", assessment: { title: "اختبار", lesson: { title: "الخلية" } }, questions: [{ id: "aq1", text: "سؤال", options: [{ id: "o1", text: "خيار", sortOrder: 1 }] }] });
  mocks.save.mockResolvedValue({ assessmentQuestionId: "aq1", selectedOptionId: "o1", answered: true });
  mocks.submit.mockResolvedValue({ attemptId: "t1", earnedPoints: 1, totalPoints: 2, percentage: 50, questionResults: [] });
});

describe("student attempt API", () => {
  it.each([[new AuthenticationRequiredError(), 401], [new AuthorizationDeniedError(), 403]] as const)("protects start", async (error, status) => { mocks.start.mockRejectedValue(error); expect((await start()).status).toBe(status); });
  it("starts with 201 and never leaks correctness", async () => { const response = await start(); const text = await response.text(); expect(response.status).toBe(201); expect(text).not.toContain("isCorrect"); expect(text).not.toContain("correctOption"); expect(response.headers.get("cache-control")).toBe("private, no-store"); });
  it.each(["assessment_not_found", "attempt_not_found"])("maps missing resources", async code => { mocks.start.mockRejectedValue(new AttemptServiceError(code as never)); expect((await start()).status).toBe(404); });
  it("saves a valid answer", async () => { const response = await answer(); expect(response.status).toBe(200); expect(mocks.save).toHaveBeenCalledWith("t1", "aq1", { optionId: "o1" }); });
  it("rejects malformed answer JSON", async () => { expect((await answer("{")).status).toBe(400); expect(mocks.save).not.toHaveBeenCalled(); });
  it("rejects ownership failures without details", async () => { mocks.save.mockRejectedValue(new AttemptServiceError("attempt_not_found")); const response = await answer(); expect(response.status).toBe(404); expect(await response.json()).toEqual({ success: false, message: "attempt_not_found" }); });
  it("returns an auto-graded result", async () => { const response = await submit(); expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ success: true, result: { earnedPoints: 1, totalPoints: 2, percentage: 50 } }); });
  it("returns conflict for repeat submit", async () => { mocks.submit.mockRejectedValue(new AttemptServiceError("attempt_submitted")); expect((await submit()).status).toBe(409); });
  it("hides unexpected errors", async () => { vi.spyOn(console, "error").mockImplementation(() => {}); mocks.submit.mockRejectedValue(new Error("raw SQL details")); const response = await submit(); expect(response.status).toBe(500); expect(await response.json()).toEqual({ success: false, message: "تعذر إتمام عملية الاختبار. حاولي مرة أخرى." }); });
});
