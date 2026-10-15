import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn(), set: vi.fn() }));
vi.mock("@/lib/auth/authorization", () => ({
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {},
  AuthorizationDeniedError: class AuthorizationDeniedError extends Error {},
  requireAdmin: mocks.auth,
}));
vi.mock("@/lib/assignments/assignment-review-service", () => ({
  AssignmentReviewServiceError: class AssignmentReviewServiceError extends Error { constructor(public code: string) { super(code); } },
  listAssignmentReviews: mocks.list,
  setAssignmentGrade: mocks.set,
}));

import { AuthenticationRequiredError, AuthorizationDeniedError } from "@/lib/auth/authorization";
import { AssignmentReviewServiceError } from "@/lib/assignments/assignment-review-service";
import { GET } from "./[assignmentId]/reviews/route";
import { PUT } from "./[assignmentId]/reviews/[studentId]/route";

const context = { params: Promise.resolve({ assignmentId: "a1", studentId: "st1" }) };
const put = (body: unknown = { score: 1 }) => PUT(new Request("http://localhost", { method: "PUT", body: JSON.stringify(body) }), context);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ id: "admin" });
  mocks.list.mockResolvedValue({ assignment: { id: "a1" }, students: [] });
  mocks.set.mockResolvedValue({ score: 1, gradedAt: new Date("2026-10-15") });
});

describe("assignment review APIs", () => {
  it.each([[new AuthenticationRequiredError(), 401], [new AuthorizationDeniedError(), 403]] as const)("protects GET and PUT", async (error, status) => {
    mocks.auth.mockRejectedValue(error);
    expect((await GET(new Request("http://localhost"), context)).status).toBe(status);
    expect((await put()).status).toBe(status);
  });
  it("returns a private safe review list", async () => {
    const response = await GET(new Request("http://localhost"), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ success: true, assignment: { id: "a1" }, students: [] });
  });
  it.each([1, 0] as const)("stores score %s", async score => {
    mocks.set.mockResolvedValue({ score, gradedAt: new Date("2026-10-15") });
    const response = await put({ score });
    expect(response.status).toBe(200);
    expect(mocks.set).toHaveBeenCalledWith({ assignmentId: "a1", studentId: "st1", score });
  });
  it.each([{ score: 2 }, { score: -1 }, { score: 0.5 }, null, [], { score: 1, reviewerId: "forged" }])("rejects unsafe input %#", async body => {
    expect((await put(body)).status).toBe(400);
    expect(mocks.set).not.toHaveBeenCalled();
  });
  it("rejects malformed JSON", async () => {
    const response = await PUT(new Request("http://localhost", { method: "PUT", body: "{" }), context);
    expect(response.status).toBe(400);
  });
  it.each([["assignment_not_found", 404], ["student_not_found", 404], ["student_not_eligible", 409]] as const)("maps %s without leaking internals", async (code, status) => {
    mocks.set.mockRejectedValue(new AssignmentReviewServiceError(code));
    expect((await put()).status).toBe(status);
  });
  it("does not leak unexpected database errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.set.mockRejectedValue(new Error("private Prisma query"));
    const response = await put();
    expect(response.status).toBe(500);
    expect((await response.json()).message).not.toContain("Prisma");
  });
});
