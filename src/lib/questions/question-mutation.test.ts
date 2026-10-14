import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
const m = vi.hoisted(() => ({ auth: vi.fn(), find: vi.fn(), update: vi.fn(), remove: vi.fn(), options: vi.fn(), objective: vi.fn(), lock: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/auth/authorization", () => ({ requireAdmin: m.auth }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { question: { findUnique: m.find }, $transaction: m.transaction } }));
import { getQuestion, updateQuestion, deleteQuestion } from "./question-service";
const row = () => ({ id: "q", text: "سؤال", type: "MULTIPLE_CHOICE", explanation: "شرح سابق", difficulty: "MEDIUM", lesson: { id: "l" }, learningObjective: null, options: [], _count: { assessmentLinks: 0, options: 2 } });
const input = () => ({ text: " نص جديد ", difficulty: "HARD", options: [{ text: "أ", isCorrect: false }, { text: "ب", isCorrect: true }] });
const tx = { $queryRaw: m.lock, question: { findUnique: m.find, update: m.update, delete: m.remove }, questionOption: { deleteMany: m.options }, learningObjective: { findUnique: m.objective } };
beforeEach(() => {
  vi.resetAllMocks(); m.auth.mockResolvedValue({ id: "admin" }); m.find.mockResolvedValue(row()); m.update.mockResolvedValue(row());
  m.objective.mockResolvedValue({ lessonId: "l" }); m.transaction.mockImplementation((fn: (client: typeof tx) => unknown) => fn(tx));
});
describe("question read/update/delete", () => {
  it.each([0, 1])("exposes usage %s but no assessment details and orders options", async count => {
    m.find.mockResolvedValue({ ...row(), _count: { assessmentLinks: count } });
    const result = await getQuestion("q"); expect(result.isUsed).toBe(Boolean(count)); expect(result).not.toHaveProperty("_count");
    expect(m.find.mock.calls[0][0].select.options.orderBy).toEqual({ sortOrder: "asc" });
    expect(m.find.mock.calls[0][0].select).not.toHaveProperty("assessmentLinks");
  });
  it.each([getQuestion, deleteQuestion, (id: string) => updateQuestion(id, input())])("rejects missing records", async action => {
    m.find.mockResolvedValue(null); await expect(action("missing")).rejects.toMatchObject({ code: "question_not_found" });
  });
  it.each([getQuestion, deleteQuestion, (id: string) => updateQuestion(id, input())])("authorizes before queries", async action => {
    m.auth.mockRejectedValue(new Error("forbidden")); await expect(action("q")).rejects.toThrow("forbidden"); expect(m.find).not.toHaveBeenCalled(); expect(m.transaction).not.toHaveBeenCalled();
  });
  it.each([2, 6])("replaces %s options atomically with array ordering and preserves identity", async count => {
    const options = Array.from({ length: count }, (_, i) => ({ text: `خيار ${count - i}`, isCorrect: i === 1 }));
    await updateQuestion("q", { ...input(), options, explanation: " شرح جديد " });
    expect(m.options).toHaveBeenCalledWith({ where: { questionId: "q" } });
    expect(m.update.mock.calls[0][0]).toMatchObject({ where: { id: "q" }, data: { text: "نص جديد", explanation: "شرح جديد", difficulty: "HARD", options: { create: options.map((o, i) => ({ ...o, sortOrder: i + 1 })) } } });
    expect(m.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "ReadCommitted" });
    expect(m.lock.mock.invocationCallOrder[0]).toBeLessThan(m.find.mock.invocationCallOrder[0]);
  });
  it.each(["id", "lessonId", "type", "createdById", "source", "status", "reviewedById", "conceptId", "createdAt", "updatedAt", "points"])("rejects forbidden %s", async key => {
    await expect(updateQuestion("q", { ...input(), [key]: "forged" })).rejects.toThrow(); expect(m.options).not.toHaveBeenCalled();
  });
  it.each([[], [{ text: "أ", isCorrect: true }], [{ text: "أ", isCorrect: true }, { text: " أ ", isCorrect: false }], [{ text: "أ", isCorrect: true }, { text: "ب", isCorrect: true }], [{ text: "أ", isCorrect: false }, { text: "ب", isCorrect: false }]].map(options => ({ options })))("rejects invalid options $options", async ({ options }) => {
    await expect(updateQuestion("q", { ...input(), options })).rejects.toThrow(); expect(m.options).not.toHaveBeenCalled();
  });
  it("preserves omitted optional fields and clears explicit null", async () => {
    m.find.mockResolvedValue({ ...row(), learningObjective: { id: "o" } });
    await updateQuestion("q", input()); expect(m.update.mock.calls[0][0].data).toMatchObject({ explanation: "شرح سابق", learningObjectiveId: "o" });
    await updateQuestion("q", { ...input(), explanation: null, learningObjectiveId: null });
    expect(m.update.mock.calls[1][0].data).toMatchObject({ explanation: null, learningObjectiveId: null });
  });
  it("validates objective against the original lesson", async () => {
    await updateQuestion("q", { ...input(), learningObjectiveId: "o" });
    expect(m.update.mock.calls[0][0].data.learningObjectiveId).toBe("o");
    m.objective.mockResolvedValue(null); await expect(updateQuestion("q", { ...input(), learningObjectiveId: "o" })).rejects.toMatchObject({ code: "objective_not_found" });
    m.objective.mockResolvedValue({ lessonId: "other" }); await expect(updateQuestion("q", { ...input(), learningObjectiveId: "o" })).rejects.toMatchObject({ code: "objective_lesson_mismatch" });
  });
  it.each([true, false])("generates fixed TRUE_FALSE options for %s", async correctAnswer => {
    m.find.mockResolvedValue({ ...row(), type: "TRUE_FALSE" });
    await updateQuestion("q", { text: "عبارة", difficulty: "MEDIUM", correctAnswer });
    expect(m.update.mock.calls[0][0].data.options.create).toEqual([{ text: "صحيح", isCorrect: correctAnswer, sortOrder: 1 }, { text: "خطأ", isCorrect: !correctAnswer, sortOrder: 2 }]);
    await expect(updateQuestion("q", { text: "عبارة", difficulty: "MEDIUM", correctAnswer, options: [] })).rejects.toThrow();
  });
  it.each(["MULTIPLE_CHOICE", "TRUE_FALSE"])("blocks used %s before any write", async type => {
    m.find.mockResolvedValue({ ...row(), type, _count: { assessmentLinks: 1 } });
    await expect(updateQuestion("q", input())).rejects.toMatchObject({ code: "question_used" });
    await expect(deleteQuestion("q")).rejects.toMatchObject({ code: "question_used" });
    expect(m.options).not.toHaveBeenCalled(); expect(m.remove).not.toHaveBeenCalled();
  });
  it("rejects the transaction when option insertion fails", async () => {
    const error = new Error("insertion failure"); m.update.mockRejectedValue(error);
    await expect(updateQuestion("q", input())).rejects.toBe(error); await expect(m.transaction.mock.results[0].value).rejects.toBe(error);
  });
  it("deletes the question only, relying on database cascade", async () => {
    await deleteQuestion("q"); expect(m.remove).toHaveBeenCalledWith({ where: { id: "q" } }); expect(m.options).not.toHaveBeenCalled();
  });
  it.each([["P2003", "question_used"], ["P2025", "question_not_found"], ["P2034", "question_conflict"]])("maps delete race %s", async (code, expected) => {
    m.remove.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("private", { code, clientVersion: "7" }));
    await expect(deleteQuestion("q")).rejects.toMatchObject({ code: expected });
  });
  it("propagates unexpected delete failures", async () => { m.remove.mockRejectedValue(new Error("database")); await expect(deleteQuestion("q")).rejects.toThrow("database"); });
});
