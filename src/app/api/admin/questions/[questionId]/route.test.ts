import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
const m = vi.hoisted(() => ({ auth: vi.fn(), find: vi.fn(), update: vi.fn(), remove: vi.fn(), options: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/auth/authorization", async original => ({ ...await original<typeof import("@/lib/auth/authorization")>(), requireAdmin: m.auth }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { question: { findUnique: m.find }, $transaction: m.transaction } }));
import { AuthenticationRequiredError, AuthorizationDeniedError } from "@/lib/auth/authorization";
import { GET, PATCH, DELETE } from "./route";
const row = (type = "MULTIPLE_CHOICE", used = false) => ({ id: "q", type, lesson: { id: "l" }, explanation: null, learningObjective: null, options: [], _count: { assessmentLinks: Number(used) } });
const input = { text: "سؤال", difficulty: "MEDIUM", options: [{ text: "أ", isCorrect: true }, { text: "ب", isCorrect: false }] };
const call = (method: "GET" | "PATCH" | "DELETE", body: unknown = input, raw = false) => ({ GET, PATCH, DELETE })[method](new Request("http://localhost/api/admin/questions/q", { method, ...(method === "PATCH" ? { body: raw ? String(body) : JSON.stringify(body) } : {}) }), { params: Promise.resolve({ questionId: "q" }) });
beforeEach(() => {
  vi.resetAllMocks(); m.auth.mockResolvedValue({ id: "admin" }); m.find.mockResolvedValue(row()); m.update.mockResolvedValue(row());
  const tx = { $queryRaw: vi.fn(), question: { findUnique: m.find, update: m.update, delete: m.remove }, questionOption: { deleteMany: m.options } };
  m.transaction.mockImplementation((fn: (client: typeof tx) => unknown) => fn(tx));
});
afterEach(() => vi.restoreAllMocks());
it.each(["GET", "PATCH", "DELETE"] as const)("%s handles authorization, missing records and private errors", async method => {
  for (const [error, status] of [[new AuthenticationRequiredError(), 401], [new AuthorizationDeniedError(), 403]] as const) {
    m.auth.mockRejectedValue(error); expect((await call(method)).status).toBe(status); expect(m.find).not.toHaveBeenCalled();
  }
  m.auth.mockResolvedValue({ id: "admin" }); m.find.mockResolvedValue(null); expect((await call(method)).status).toBe(404);
  vi.spyOn(console, "error").mockImplementation(() => {}); m.find.mockRejectedValue(new Error("private SQL"));
  const response = await call(method); expect(response.status).toBe(500); expect(await response.text()).not.toContain("private SQL");
});
it("GET returns an administrative detail response without caching", async () => {
  const response = await call("GET"); expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.json()).toMatchObject({ success: true, question: { id: "q", isUsed: false } });
});
it.each([null, [], false, 2, "text", { ...input, lessonId: "other" }, { ...input, type: "TRUE_FALSE" }, { ...input, id: "fake" }, { ...input, text: " " }])("PATCH rejects %j", async body => {
  expect((await call("PATCH", body)).status).toBe(400); expect(m.options).not.toHaveBeenCalled();
});
it("PATCH rejects malformed JSON", async () => { expect((await call("PATCH", "{", true)).status).toBe(400); expect(m.transaction).not.toHaveBeenCalled(); });
it.each(["MULTIPLE_CHOICE", "TRUE_FALSE"])("PATCH saves %s", async type => {
  m.find.mockResolvedValue(row(type));
  expect((await call("PATCH", type === "TRUE_FALSE" ? { text: "عبارة", difficulty: "EASY", correctAnswer: false } : input)).status).toBe(200);
  expect(m.update).toHaveBeenCalledOnce();
});
it("rejects client-controlled true/false labels", async () => {
  m.find.mockResolvedValue(row("TRUE_FALSE")); expect((await call("PATCH", { ...input, correctAnswer: true })).status).toBe(400);
});
it.each(["PATCH", "DELETE"] as const)("%s rejects used questions", async method => {
  m.find.mockResolvedValue(row("MULTIPLE_CHOICE", true)); expect((await call(method)).status).toBe(409); expect(m.remove).not.toHaveBeenCalled(); expect(m.options).not.toHaveBeenCalled();
});
it("DELETE succeeds for an unused question", async () => { expect((await call("DELETE")).status).toBe(200); expect(m.remove).toHaveBeenCalledOnce(); });
it("DELETE translates the FK race into 409 without database details", async () => {
  m.remove.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("private FK", { code: "P2003", clientVersion: "7" }));
  const response = await call("DELETE"); expect(response.status).toBe(409); expect(await response.text()).not.toContain("private FK");
});
