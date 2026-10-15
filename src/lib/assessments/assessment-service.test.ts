import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), transaction: vi.fn(), lesson: vi.fn(), questions: vi.fn(), create: vi.fn(),
  list: vi.fn(), get: vi.fn(), grades: vi.fn(), creationQuestions: vi.fn(),
}));
vi.mock("@/lib/auth/authorization", () => ({ requireAdmin: mocks.auth }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {
  $transaction: mocks.transaction,
  assessment: { findMany: mocks.list, findUnique: mocks.get },
  grade: { findMany: mocks.grades }, question: { findMany: mocks.creationQuestions },
} }));
import { createAssessment, getAssessment, getAssessmentCreationData, listAssessments } from "./assessment-service";

const input = () => ({ title: " اختبار ", lessonId: "lesson-1", questionIds: ["q2", "q1"] });
const lesson = { id: "lesson-1", unit: { semester: { gradeId: "grade-6" } } };
const questions = [
  { id: "q1", lessonId: "lesson-1", type: "MULTIPLE_CHOICE" },
  { id: "q2", lessonId: "lesson-1", type: "TRUE_FALSE" },
];
const tx = { lesson: { findUnique: mocks.lesson }, question: { findMany: mocks.questions }, assessment: { create: mocks.create } };

beforeEach(() => {
  vi.resetAllMocks(); mocks.auth.mockResolvedValue({ id: "admin-1" }); mocks.lesson.mockResolvedValue(lesson);
  mocks.questions.mockResolvedValue(questions); mocks.create.mockResolvedValue({ id: "assessment-1" });
  mocks.transaction.mockImplementation((callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
  mocks.list.mockResolvedValue([]); mocks.grades.mockResolvedValue([]); mocks.creationQuestions.mockResolvedValue([]);
});

describe("createAssessment", () => {
  it("derives grade and owns workflow fields on the server", async () => {
    expect(await createAssessment(input())).toEqual({ id: "assessment-1" });
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      title: "اختبار", lessonId: "lesson-1", gradeId: "grade-6", type: "QUIZ", status: "DRAFT",
      durationSeconds: 0, createdById: "admin-1",
    }) }));
  });
  it("keeps client question order and leaves points and snapshots unset", async () => {
    await createAssessment(input());
    expect(mocks.create.mock.calls[0][0].data.questions.create).toEqual([
      { questionId: "q2", sortOrder: 1, pointsOverride: null },
      { questionId: "q1", sortOrder: 2, pointsOverride: null },
    ]);
    expect(mocks.create.mock.calls[0][0].data.questions.create[0]).not.toHaveProperty("questionSnapshot");
  });
  it("loads the lesson grade through unit and semester", async () => {
    await createAssessment(input());
    expect(mocks.lesson).toHaveBeenCalledWith({ where: { id: "lesson-1" }, select: { id: true, unit: { select: { semester: { select: { gradeId: true } } } } } });
  });
  it("rejects a missing lesson before reading questions", async () => {
    mocks.lesson.mockResolvedValue(null); await expect(createAssessment(input())).rejects.toMatchObject({ code: "lesson_not_found" });
    expect(mocks.questions).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("rejects a missing question", async () => {
    mocks.questions.mockResolvedValue([questions[0]]); await expect(createAssessment(input())).rejects.toMatchObject({ code: "question_not_found" });
  });
  it("rejects a question from another lesson", async () => {
    mocks.questions.mockResolvedValue([{ ...questions[0], lessonId: "other" }, questions[1]]);
    await expect(createAssessment(input())).rejects.toMatchObject({ code: "question_lesson_mismatch" });
  });
  it("rejects unsupported question types", async () => {
    mocks.questions.mockResolvedValue([{ ...questions[0], type: "MATCHING" }, questions[1]]);
    await expect(createAssessment(input())).rejects.toMatchObject({ code: "question_type_unsupported" });
  });
  it("validates duplicates and empty lists before opening a transaction", async () => {
    await expect(createAssessment({ ...input(), questionIds: [] })).rejects.toThrow();
    await expect(createAssessment({ ...input(), questionIds: ["q1", "q1"] })).rejects.toThrow();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("rolls back by propagating nested create failures", async () => {
    const failure = new Error("write failed"); mocks.create.mockRejectedValue(failure);
    await expect(createAssessment(input())).rejects.toBe(failure);
    await expect(mocks.transaction.mock.results[0].value).rejects.toBe(failure);
  });
  it("requires admin before validation and persistence", async () => {
    mocks.auth.mockRejectedValue(new Error("forbidden")); await expect(createAssessment(null)).rejects.toThrow("forbidden");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe("assessment reads", () => {
  const row = { id: "a1", title: "اختبار", type: "QUIZ", status: "DRAFT", durationSeconds: 0, createdAt: new Date("2026-10-15T00:00:00Z"),
    lesson: { id: "l", title: "الخلية", unit: { id: "u", title: "الوحدة", semester: { id: "s", name: "الفصل الأول", academicYear: "2026-2027", grade: { id: "g", name: "الصف السادس" } } } },
    questions: [{ pointsOverride: null, question: { points: 2 } }, { pointsOverride: 4, question: { points: 1 } }] };
  it("lists deterministically with counts and effective points", async () => {
    mocks.list.mockResolvedValue([row]); const result = await listAssessments();
    expect(result[0]).toMatchObject({ id: "a1", questionCount: 2, totalPoints: 6 });
    expect(result[0]).not.toHaveProperty("questions");
    expect(mocks.list.mock.calls[0][0].orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
  });
  it("returns an empty list", async () => expect(await listAssessments()).toEqual([]));
  it("gets a detail and reports missing records", async () => {
    mocks.get.mockResolvedValue(row); expect(await getAssessment(" a1 ")).toMatchObject({ questionCount: 2, totalPoints: 6 });
    mocks.get.mockResolvedValue(null); await expect(getAssessment("missing")).rejects.toMatchObject({ code: "assessment_not_found" });
  });
  it("loads lightweight curriculum and supported questions", async () => {
    expect(await getAssessmentCreationData()).toEqual({ curriculum: [], questions: [] });
    expect(mocks.creationQuestions.mock.calls[0][0].where).toEqual({ type: { in: ["MULTIPLE_CHOICE", "TRUE_FALSE"] } });
  });
});
