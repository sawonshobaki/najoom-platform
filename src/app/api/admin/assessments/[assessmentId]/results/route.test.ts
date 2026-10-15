import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), results: vi.fn() }));
vi.mock("@/lib/auth/authorization", () => ({ AuthenticationRequiredError: class AuthenticationRequiredError extends Error {}, AuthorizationDeniedError: class AuthorizationDeniedError extends Error {}, requireAdmin: mocks.auth }));
vi.mock("@/lib/assessments/assessment-service", () => ({ AssessmentServiceError: class AssessmentServiceError extends Error { constructor(public code: string) { super(code); } } }));
vi.mock("@/lib/assessments/assessment-results-service", () => ({ getAssessmentResults: mocks.results }));
import { AuthenticationRequiredError, AuthorizationDeniedError } from "@/lib/auth/authorization";
import { AssessmentServiceError } from "@/lib/assessments/assessment-service";
import { GET } from "./route";
const call = () => GET(new Request("http://localhost"), { params: Promise.resolve({ assessmentId: "a1" }) });
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ id: "admin" }); mocks.results.mockResolvedValue({ id: "a1", attempts: [] }); });
describe("assessment results route", () => {
  it.each([[new AuthenticationRequiredError(), 401], [new AuthorizationDeniedError(), 403]] as const)("protects results", async (error, status) => { mocks.auth.mockRejectedValue(error); expect((await call()).status).toBe(status); expect(mocks.results).not.toHaveBeenCalled(); });
  it("returns private results", async () => { const response = await call(); expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store"); expect(await response.json()).toEqual({ success: true, results: { id: "a1", attempts: [] } }); });
  it("returns 404 for missing assessment", async () => { mocks.results.mockRejectedValue(new AssessmentServiceError("assessment_not_found")); expect((await call()).status).toBe(404); });
  it("does not leak internal errors", async () => { vi.spyOn(console, "error").mockImplementation(() => {}); mocks.results.mockRejectedValue(new Error("snapshot secret")); const response = await call(); expect(response.status).toBe(500); expect((await response.json()).message).not.toContain("snapshot"); });
});
