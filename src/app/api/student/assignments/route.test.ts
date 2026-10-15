import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/auth/authorization", () => ({ AuthenticationRequiredError: class AuthenticationRequiredError extends Error {}, AuthorizationDeniedError: class AuthorizationDeniedError extends Error {}, requireStudent: mocks.auth }));
vi.mock("@/lib/assignments/assignment-service", () => ({ AssignmentServiceError: class AssignmentServiceError extends Error { constructor(public code: string) { super(code); } }, listStudentAssignments: mocks.list }));
import { AuthenticationRequiredError, AuthorizationDeniedError } from "@/lib/auth/authorization";
import { GET } from "./route";
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ id: "student" }); mocks.list.mockResolvedValue([]); });
describe("student assignments API", () => {
  it.each([[new AuthenticationRequiredError(), 401], [new AuthorizationDeniedError(), 403]] as const)("protects student archive", async (error, status) => { mocks.auth.mockRejectedValue(error); expect((await GET()).status).toBe(status); expect(mocks.list).not.toHaveBeenCalled(); });
  it("returns a private student-safe list", async () => { const response = await GET(); expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store"); expect(await response.json()).toEqual({ success: true, assignments: [] }); });
  it("hides unexpected errors", async () => { vi.spyOn(console, "error").mockImplementation(() => {}); mocks.list.mockRejectedValue(new Error("raw prisma")); const response = await GET(); expect(response.status).toBe(500); expect((await response.json()).message).not.toContain("prisma"); });
});
