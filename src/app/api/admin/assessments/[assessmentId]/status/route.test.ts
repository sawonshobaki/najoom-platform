import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), publish: vi.fn(), close: vi.fn() }));
vi.mock("@/lib/auth/authorization", () => ({
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {}, AuthorizationDeniedError: class AuthorizationDeniedError extends Error {}, requireAdmin: mocks.auth,
}));
vi.mock("@/lib/assessments/assessment-service", () => ({
  AssessmentServiceError: class AssessmentServiceError extends Error { constructor(public code: string) { super(code); } }, publishAssessment: mocks.publish, closeAssessment: mocks.close,
}));
import { AuthenticationRequiredError, AuthorizationDeniedError } from "@/lib/auth/authorization";
import { AssessmentServiceError } from "@/lib/assessments/assessment-service";
import { PATCH } from "./route";
const call = (body: unknown = { status: "PUBLISHED" }) => PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify(body) }), { params: Promise.resolve({ assessmentId: "a1" }) });
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ id: "admin" }); mocks.publish.mockResolvedValue({ id: "a1", status: "PUBLISHED" }); mocks.close.mockResolvedValue({ id: "a1", status: "CLOSED" }); });
describe("assessment status route", () => {
  it.each([[new AuthenticationRequiredError(), 401], [new AuthorizationDeniedError(), 403]] as const)("protects status changes", async (error, status) => { mocks.auth.mockRejectedValue(error); expect((await call()).status).toBe(status); });
  it("publishes and closes through explicit targets", async () => { expect((await call()).status).toBe(200); expect(mocks.publish).toHaveBeenCalledWith("a1"); expect((await call({ status: "CLOSED" })).status).toBe(200); expect(mocks.close).toHaveBeenCalledWith("a1"); });
  it.each([null, [], {}, { status: "DRAFT" }, { status: "PUBLISHED", id: "forged" }])("rejects invalid body %j", async body => { expect((await call(body)).status).toBe(400); expect(mocks.publish).not.toHaveBeenCalled(); });
  it("rejects malformed JSON", async () => { const response = await PATCH(new Request("http://localhost", { method: "PATCH", body: "{" }), { params: Promise.resolve({ assessmentId: "a1" }) }); expect(response.status).toBe(400); });
  it.each([["assessment_not_found", 404], ["assessment_invalid_transition", 409], ["assessment_conflict", 409], ["assessment_empty", 400]] as const)("maps %s", async (code, status) => { mocks.publish.mockRejectedValue(new AssessmentServiceError(code)); expect((await call()).status).toBe(status); });
  it("hides internal errors", async () => { vi.spyOn(console, "error").mockImplementation(() => {}); mocks.publish.mockRejectedValue(new Error("SQL private")); const response = await call(); expect(response.status).toBe(500); expect((await response.json()).message).not.toContain("SQL"); });
});
