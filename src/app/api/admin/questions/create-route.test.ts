import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), lesson: vi.fn(), objective: vi.fn(), create: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/auth/authorization", async original => ({ ...await original<typeof import("@/lib/auth/authorization")>(), requireAdmin: mocks.auth }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
import { AuthenticationRequiredError, AuthorizationDeniedError } from "@/lib/auth/authorization";
import { POST } from "./route";
const input = () => ({ lessonId: "lesson-1", text: "سؤال", type: "MULTIPLE_CHOICE", difficulty: "MEDIUM", options: [{ text: "أ", isCorrect: true }, { text: "ب", isCorrect: false }] });
const request = (body: unknown) => POST(new Request("http://localhost/api/admin/questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
beforeEach(() => {
  vi.resetAllMocks(); mocks.auth.mockResolvedValue({ id: "admin-1" }); mocks.lesson.mockResolvedValue({ id: "lesson-1" }); mocks.objective.mockResolvedValue({ lessonId: "lesson-1" });
  mocks.create.mockResolvedValue({ id: "q", ...input(), explanation: null, lesson: { id: "lesson-1", title: "الخلية" }, learningObjective: null,
    options: input().options.map((o, i) => ({ ...o, id: `o${i}`, sortOrder: i + 1 })) });
  const tx = { lesson: { findUnique: mocks.lesson }, learningObjective: { findUnique: mocks.objective }, question: { create: mocks.create } };
  mocks.transaction.mockImplementation((callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
});
afterEach(() => vi.restoreAllMocks());
describe("POST admin questions", () => {
  it.each([[new AuthenticationRequiredError(), 401], [new AuthorizationDeniedError(), 403]] as const)("protects creation", async (error, status) => {
    mocks.auth.mockRejectedValue(error); expect((await request(null)).status).toBe(status); expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("rejects malformed JSON", async () => {
    expect((await POST(new Request("http://localhost/api/admin/questions", { method: "POST", body: "{" }))).status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it.each([null, [], 1, "text", false])("rejects non-object body %j", async body => {
    expect((await request(body)).status).toBe(400); expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("returns 201 with ordered admin options", async () => {
    const response = await request(input()); expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ success: true, question: { id: "q", options: [
      { id: "o0", text: "أ", sortOrder: 1, isCorrect: true }, { id: "o1", text: "ب", sortOrder: 2, isCorrect: false },
    ] } });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it.each([{ text: " " }, { type: "TRUE_FALSE" }, { type: "MATCHING" }, { createdById: "forged" }, { options: [] }])("rejects invalid input %j", async patch => {
    expect((await request({ ...input(), ...patch })).status).toBe(400); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("returns 404 for missing lesson", async () => { mocks.lesson.mockResolvedValue(null); expect((await request(input())).status).toBe(404); });
  it("returns 404 for missing objective", async () => { mocks.objective.mockResolvedValue(null); expect((await request({ ...input(), learningObjectiveId: "missing" })).status).toBe(404); });
  it("returns 400 for an objective from another lesson", async () => { mocks.objective.mockResolvedValue({ lessonId: "other" }); expect((await request({ ...input(), learningObjectiveId: "other" })).status).toBe(400); });
  it("hides internal failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {}); mocks.create.mockRejectedValue(new Error("private SQL details"));
    const response = await request(input()); expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, message: "تعذر حفظ السؤال. حاولي مرة أخرى." });
  });
  it.each([true, false])("returns 201 for TRUE_FALSE with correctAnswer %s", async correctAnswer => {
    mocks.create.mockImplementation(async ({ data }) => ({ id: "tf", type: data.type, options: data.options.create.map((o: object, i: number) => ({ ...o, id: `o${i}` })) }));
    const response = await request({ lessonId: "lesson-1", text: "عبارة", type: "TRUE_FALSE", difficulty: "MEDIUM", correctAnswer });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ success: true, question: { id: "tf", type: "TRUE_FALSE", options: [
      { id: "o0", text: "صحيح", sortOrder: 1, isCorrect: correctAnswer }, { id: "o1", text: "خطأ", sortOrder: 2, isCorrect: !correctAnswer },
    ] } });
  });
  it.each([{ correctAnswer: "false" }, { correctAnswer: null }, {}, { correctAnswer: true, options: [] }, { correctAnswer: false, labels: ["custom"] }])("rejects malformed TRUE_FALSE %j", async fields => {
    const response = await request({ lessonId: "lesson-1", text: "عبارة", type: "TRUE_FALSE", difficulty: "MEDIUM", ...fields });
    expect(response.status).toBe(400); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("hides TRUE_FALSE persistence failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {}); mocks.create.mockRejectedValue(new Error("private SQL details"));
    const response = await request({ lessonId: "lesson-1", text: "عبارة", type: "TRUE_FALSE", difficulty: "MEDIUM", correctAnswer: false });
    expect(response.status).toBe(500); expect(await response.json()).toEqual({ success: false, message: "تعذر حفظ السؤال. حاولي مرة أخرى." });
  });
});
