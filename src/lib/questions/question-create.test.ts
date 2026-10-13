import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), lesson: vi.fn(), objective: vi.fn(), create: vi.fn(), transaction: vi.fn(), grades: vi.fn(), objectives: vi.fn() }));
vi.mock("@/lib/auth/authorization", () => ({ requireAdmin: mocks.auth }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: mocks.transaction, grade: { findMany: mocks.grades }, learningObjective: { findMany: mocks.objectives } } }));
import { createQuestion, getQuestionCreationData } from "./question-service";

const input = () => ({ lessonId: "lesson-1", type: "MULTIPLE_CHOICE", text: " سؤال ", explanation: " شرح ", difficulty: "MEDIUM",
  options: [{ text: " أول ", isCorrect: true }, { text: "ثانٍ", isCorrect: false }] });
const tx = { lesson: { findUnique: mocks.lesson }, learningObjective: { findUnique: mocks.objective }, question: { create: mocks.create } };
beforeEach(() => {
  vi.resetAllMocks(); mocks.auth.mockResolvedValue({ id: "session-admin" }); mocks.lesson.mockResolvedValue({ id: "lesson-1" });
  mocks.objective.mockResolvedValue({ lessonId: "lesson-1" }); mocks.create.mockResolvedValue({ id: "new-question" });
  mocks.transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
  mocks.grades.mockResolvedValue([]); mocks.objectives.mockResolvedValue([]);
});
describe("create MCQ", () => {
  it.each([2, 6])("creates a question with %s options in one nested transaction", async count => {
    const options = Array.from({ length: count }, (_, i) => ({ text: ` خيار ${i} `, isCorrect: i === 1 }));
    expect(await createQuestion({ ...input(), options })).toEqual({ id: "new-question" });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ data: {
      lessonId: "lesson-1", learningObjectiveId: null, text: "سؤال", explanation: "شرح", type: "MULTIPLE_CHOICE", difficulty: "MEDIUM",
      createdById: "session-admin", source: "MANUAL", status: "DRAFT",
      options: { create: options.map((o, i) => ({ text: o.text.trim(), isCorrect: o.isCorrect, sortOrder: i + 1 })) },
    } }));
    expect(mocks.create.mock.calls[0][0].data).not.toHaveProperty("points");
    expect(mocks.objective).not.toHaveBeenCalled();
  });
  it("selects only the admin creation response and orders options", async () => {
    await createQuestion(input());
    const select = mocks.create.mock.calls[0][0].select;
    expect(select.options).toEqual({ orderBy: { sortOrder: "asc" }, select: { id: true, text: true, sortOrder: true, isCorrect: true } });
    expect(select).not.toHaveProperty("createdBy"); expect(select).not.toHaveProperty("createdById");
  });
  it("accepts an objective belonging to the selected lesson", async () => {
    await createQuestion({ ...input(), learningObjectiveId: "objective-1" });
    expect(mocks.create.mock.calls[0][0].data.learningObjectiveId).toBe("objective-1");
  });
  it("rejects a missing lesson before writing", async () => {
    mocks.lesson.mockResolvedValue(null); await expect(createQuestion(input())).rejects.toMatchObject({ code: "lesson_not_found" });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("rejects a missing objective before writing", async () => {
    mocks.objective.mockResolvedValue(null); await expect(createQuestion({ ...input(), learningObjectiveId: "missing" })).rejects.toMatchObject({ code: "objective_not_found" });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("rejects an objective from another lesson", async () => {
    mocks.objective.mockResolvedValue({ lessonId: "other" }); await expect(createQuestion({ ...input(), learningObjectiveId: "other-objective" })).rejects.toMatchObject({ code: "objective_lesson_mismatch" });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it.each(["MULTIPLE_SELECT", "MATCHING", "ORDERING", "FILL_IN_BLANK", "SHORT_ANSWER"])("rejects %s at the create boundary", async type => {
    await expect(createQuestion({ ...input(), type })).rejects.toThrow(); expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it.each([false, true])("rejects all options having correctness %s", async isCorrect => {
    await expect(createQuestion({ ...input(), options: input().options.map(o => ({ ...o, isCorrect })) })).rejects.toThrow();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it.each([{ text: " " }, { difficulty: "INVALID" }, { options: [] }, { options: [{ text: "a", isCorrect: "true" }, { text: "b", isCorrect: false }] }])
    ("reuses input validation for %j", async patch => {
      await expect(createQuestion({ ...input(), ...patch })).rejects.toThrow(); expect(mocks.transaction).not.toHaveBeenCalled();
    });
  it.each(["createdById", "source", "status", "reviewedById", "conceptId", "createdAt", "updatedAt", "points"])("rejects injected %s", async field => {
    await expect(createQuestion({ ...input(), [field]: "injected" })).rejects.toThrow(); expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("aborts the transaction on a nested option failure instead of swallowing the error", async () => {
    const failure = new Prisma.PrismaClientKnownRequestError("option constraint", { code: "P2002", clientVersion: "7.10.0" });
    mocks.create.mockRejectedValue(failure);
    await expect(createQuestion(input())).rejects.toBe(failure);
    await expect(mocks.transaction.mock.results[0].value).rejects.toBe(failure);
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
  it("propagates unexpected Prisma failures", async () => {
    const error = new Error("database unavailable"); mocks.create.mockRejectedValue(error);
    await expect(createQuestion(input())).rejects.toBe(error);
  });
  it("requires admin before any validation or query", async () => {
    mocks.auth.mockRejectedValue(new Error("forbidden")); await expect(createQuestion(null)).rejects.toThrow("forbidden");
    expect(mocks.transaction).not.toHaveBeenCalled();
    await expect(getQuestionCreationData()).rejects.toThrow("forbidden"); expect(mocks.grades).not.toHaveBeenCalled();
  });
  it("loads creation selectors even with no objectives", async () => {
    expect(await getQuestionCreationData()).toEqual({ curriculum: [], objectives: [] });
    expect(mocks.objectives).toHaveBeenCalledWith({ select: { id: true, title: true, lessonId: true }, orderBy: { id: "asc" } });
  });
});

describe("create TRUE_FALSE", () => {
  const tf = (correctAnswer: unknown = true) => ({ lessonId: "lesson-1", type: "TRUE_FALSE", text: "عبارة", difficulty: "MEDIUM", correctAnswer });
  it.each([true, false])("generates exactly two fixed options for %s with session metadata", async correctAnswer => {
    await createQuestion(tf(correctAnswer));
    const { data } = mocks.create.mock.calls[0][0];
    expect(data).toMatchObject({ type: "TRUE_FALSE", createdById: "session-admin", source: "MANUAL", status: "DRAFT", learningObjectiveId: null });
    expect(data.options.create).toEqual([{ text: "صحيح", isCorrect: correctAnswer, sortOrder: 1 }, { text: "خطأ", isCorrect: !correctAnswer, sortOrder: 2 }]);
    expect(data).not.toHaveProperty("correctAnswer");
    expect(mocks.transaction).toHaveBeenCalledOnce();
  });
  it.each([null, "true", "false", 0, 1, {}])("rejects invalid correctAnswer %j", async correctAnswer => {
    await expect(createQuestion(tf(correctAnswer))).rejects.toThrow(); expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("requires an explicit boolean answer", async () => {
    const { correctAnswer: omitted, ...body } = tf(); void omitted;
    await expect(createQuestion(body)).rejects.toThrow();
  });
  it.each([{ options: [] }, { options: [{ text: "custom", isCorrect: true }] }, { createdById: "fake" }, { labels: ["yes", "no"] }])("rejects client-controlled fields %j", async extra => {
    await expect(createQuestion({ ...tf(), ...extra })).rejects.toThrow(); expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("uses the same lesson and objective checks", async () => {
    mocks.lesson.mockResolvedValueOnce(null); await expect(createQuestion(tf())).rejects.toMatchObject({ code: "lesson_not_found" });
    mocks.objective.mockResolvedValueOnce(null); await expect(createQuestion({ ...tf(), learningObjectiveId: "o" })).rejects.toMatchObject({ code: "objective_not_found" });
    mocks.objective.mockResolvedValueOnce({ lessonId: "other" }); await expect(createQuestion({ ...tf(), learningObjectiveId: "o" })).rejects.toMatchObject({ code: "objective_lesson_mismatch" });
    await createQuestion({ ...tf(), learningObjectiveId: "o" }); expect(mocks.create.mock.calls[0][0].data.learningObjectiveId).toBe("o");
  });
  it("requires admin for TRUE_FALSE", async () => {
    mocks.auth.mockRejectedValue(new Error("forbidden")); await expect(createQuestion(tf())).rejects.toThrow("forbidden"); expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("rejects the entire transaction if generated option creation fails", async () => {
    const failure = new Error("option failure"); mocks.create.mockRejectedValue(failure);
    await expect(createQuestion(tf())).rejects.toBe(failure);
    await expect(mocks.transaction.mock.results[0].value).rejects.toBe(failure);
  });
});
