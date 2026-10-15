import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/auth/authorization", () => ({
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {},
  AuthorizationDeniedError: class AuthorizationDeniedError extends Error {},
  requireAdmin: mocks.auth,
}));
vi.mock("@/lib/assessments/assessment-service", () => ({
  AssessmentServiceError: class AssessmentServiceError extends Error {
    constructor(public code: string) { super(code); }
  },
  listAssessments: mocks.list, createAssessment: mocks.create,
}));
import { AuthenticationRequiredError, AuthorizationDeniedError } from "@/lib/auth/authorization";
import { AssessmentServiceError } from "@/lib/assessments/assessment-service";
import { GET, POST } from "./route";

const valid = { title: "اختبار", lessonId: "lesson-1", questionIds: ["q1"] };
const request = (body: unknown) => POST(new Request("http://localhost/api/admin/assessments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));

beforeEach(() => {
  vi.resetAllMocks(); mocks.auth.mockResolvedValue({ id: "admin" }); mocks.list.mockResolvedValue([]); mocks.create.mockResolvedValue({ id: "a1" });
});

describe("admin assessment routes", () => {
  it.each([[new AuthenticationRequiredError(), 401], [new AuthorizationDeniedError(), 403]] as const)("protects GET with %s", async (error, status) => {
    mocks.auth.mockRejectedValue(error); expect((await GET()).status).toBe(status); expect(mocks.list).not.toHaveBeenCalled();
  });
  it("lists assessments without caching", async () => {
    mocks.list.mockResolvedValue([{ id: "a1" }]); const response = await GET();
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ success: true, assessments: [{ id: "a1" }] });
  });
  it.each([[new AuthenticationRequiredError(), 401], [new AuthorizationDeniedError(), 403]] as const)("protects POST with %s", async (error, status) => {
    mocks.auth.mockRejectedValue(error); expect((await request(valid)).status).toBe(status); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("returns 201 for valid creation", async () => {
    const response = await request(valid); expect(response.status).toBe(201); expect(await response.json()).toEqual({ success: true, assessment: { id: "a1" } });
    expect(mocks.create).toHaveBeenCalledWith(valid);
  });
  it("rejects malformed JSON", async () => {
    const response = await POST(new Request("http://localhost/api/admin/assessments", { method: "POST", body: "{" }));
    expect(response.status).toBe(400); expect(mocks.create).not.toHaveBeenCalled();
  });
  it.each([null, [], 1, "body", false])("rejects non-object input %j", async body => {
    mocks.create.mockImplementation(async value => { const { validateAssessmentCreateRequest } = await import("@/lib/assessments/assessment-validation"); return validateAssessmentCreateRequest(value); });
    expect((await request(body)).status).toBe(400);
  });
  it.each(["lesson_not_found", "question_not_found"] as const)("returns 404 for %s", async code => {
    mocks.create.mockRejectedValue(new AssessmentServiceError(code as never)); expect((await request(valid)).status).toBe(404);
  });
  it.each(["question_lesson_mismatch", "question_type_unsupported"] as const)("returns 400 for %s", async code => {
    mocks.create.mockRejectedValue(new AssessmentServiceError(code as never)); expect((await request(valid)).status).toBe(400);
  });
  it("does not leak unexpected errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {}); mocks.create.mockRejectedValue(new Error("private SQL"));
    const response = await request(valid); expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, message: "تعذر إتمام عملية الاختبار. حاولي مرة أخرى." });
  });
});
