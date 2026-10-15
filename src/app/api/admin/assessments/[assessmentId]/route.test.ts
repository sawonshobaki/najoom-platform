import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), get: vi.fn() }));
vi.mock("@/lib/auth/authorization", () => ({
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {},
  AuthorizationDeniedError: class AuthorizationDeniedError extends Error {},
  requireAdmin: mocks.auth,
}));
vi.mock("@/lib/assessments/assessment-service", () => ({
  AssessmentServiceError: class AssessmentServiceError extends Error {
    constructor(public code: string) { super(code); }
  },
  getAssessment: mocks.get,
}));
import { AuthenticationRequiredError, AuthorizationDeniedError } from "@/lib/auth/authorization";
import { AssessmentServiceError } from "@/lib/assessments/assessment-service";
import { GET } from "./route";
const call = () => GET(new Request("http://localhost/api/admin/assessments/a1"), { params: Promise.resolve({ assessmentId: "a1" }) });
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ id: "admin" }); mocks.get.mockResolvedValue({ id: "a1" }); });
describe("assessment detail route", () => {
  it.each([[new AuthenticationRequiredError(), 401], [new AuthorizationDeniedError(), 403]] as const)("protects detail", async (error, status) => {
    mocks.auth.mockRejectedValue(error); expect((await call()).status).toBe(status); expect(mocks.get).not.toHaveBeenCalled();
  });
  it("returns the assessment without caching", async () => {
    const response = await call(); expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ success: true, assessment: { id: "a1" } });
  });
  it("returns 404 when missing", async () => {
    mocks.get.mockRejectedValue(new AssessmentServiceError("assessment_not_found" as never)); expect((await call()).status).toBe(404);
  });
  it("hides internal failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {}); mocks.get.mockRejectedValue(new Error("private"));
    const response = await call(); expect(response.status).toBe(500); expect((await response.json()).message).toBe("تعذر تحميل الاختبار. حاولي مرة أخرى.");
  });
});
