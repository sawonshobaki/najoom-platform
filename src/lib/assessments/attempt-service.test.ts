import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), student: vi.fn(), transaction: vi.fn(),
  assessment: vi.fn(), existing: vi.fn(), createAttempt: vi.fn(), snapshot: vi.fn(), findAttempt: vi.fn(), upsert: vi.fn(),
  lock: vi.fn(), updateAnswer: vi.fn(), updateAttempt: vi.fn() }));
vi.mock("@/lib/auth/authorization", () => ({ requireStudent: mocks.auth }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { student: { findUnique: mocks.student }, $transaction: mocks.transaction } }));
import { parseQuestionSnapshot, saveAssessmentAnswer, startAssessmentAttempt, submitAssessmentAttempt, type QuestionSnapshot } from "./attempt-service";

const snapshot = (patch: Partial<QuestionSnapshot> = {}): QuestionSnapshot => ({ version: 1, questionId: "q1", text: "سؤال محفوظ", type: "MULTIPLE_CHOICE", points: 2,
  options: [{ optionId: "o1", text: "صحيح", sortOrder: 1, isCorrect: true }, { optionId: "o2", text: "غير صحيح", sortOrder: 2, isCorrect: false }], ...patch });
const assessmentQuestion = (patch: Record<string, unknown> = {}) => ({ id: "aq1", sortOrder: 1, pointsOverride: null, questionSnapshot: null,
  question: { id: "q1", text: "سؤال حي", type: "MULTIPLE_CHOICE", points: 2, options: snapshot().options.map(o => ({ id: o.optionId, text: o.text, sortOrder: o.sortOrder, isCorrect: o.isCorrect })) }, ...patch });
const startAssessment = (questions = [assessmentQuestion()]) => ({ id: "a1", title: "اختبار", status: "PUBLISHED", durationSeconds: 0, lesson: { id: "l1", title: "الخلية" }, questions });
const tx = { assessment: { findUnique: mocks.assessment }, assessmentAttempt: { findUnique: mocks.existing, create: mocks.createAttempt, update: mocks.updateAttempt },
  assessmentQuestion: { updateMany: mocks.snapshot }, assessmentAnswer: { upsert: mocks.upsert, update: mocks.updateAnswer }, $queryRaw: mocks.lock };

beforeEach(() => {
  vi.resetAllMocks(); mocks.auth.mockResolvedValue({ id: "user-1" }); mocks.student.mockResolvedValue({ id: "student-1", isActive: true });
  mocks.transaction.mockImplementation((callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
  mocks.assessment.mockResolvedValue(startAssessment()); mocks.existing.mockResolvedValue(null);
  mocks.createAttempt.mockResolvedValue({ id: "attempt-1", startedAt: new Date("2026-10-15T00:00:00Z"), status: "IN_PROGRESS" });
  mocks.snapshot.mockResolvedValue({ count: 1 }); mocks.upsert.mockResolvedValue({ id: "answer-1", answeredAt: new Date("2026-10-15T00:01:00Z") });
  mocks.lock.mockResolvedValue([]); mocks.updateAnswer.mockResolvedValue({}); mocks.updateAttempt.mockResolvedValue({});
});

describe("question snapshot", () => {
  it("parses a valid immutable grading snapshot", () => expect(parseQuestionSnapshot(snapshot())).toEqual(snapshot()));
  it.each([null, [], {}, { ...snapshot(), type: "MATCHING" }, { ...snapshot(), options: [] }, { ...snapshot(), options: snapshot().options.map(o => ({ ...o, isCorrect: false })) }])
    ("rejects malformed snapshots", value => expect(() => parseQuestionSnapshot(value as Prisma.JsonValue)).toThrow());
});

describe("startAssessmentAttempt", () => {
  it("creates an ordered student-safe attempt and snapshot", async () => {
    const result = await startAssessmentAttempt(" a1 ");
    expect(result).toMatchObject({ attemptId: "attempt-1", status: "IN_PROGRESS", assessment: { id: "a1", durationSeconds: 0 }, questions: [{ id: "aq1", sortOrder: 1, text: "سؤال حي", points: 2 }] });
    expect(JSON.stringify(result)).not.toContain("isCorrect");
    expect(mocks.snapshot.mock.calls[0][0].data.questionSnapshot).toMatchObject({ questionId: "q1", text: "سؤال حي", points: 2, options: [{ isCorrect: true }, { isCorrect: false }] });
    expect(mocks.createAttempt).toHaveBeenCalledWith({ data: { assessmentId: "a1", studentId: "student-1" }, select: { id: true, startedAt: true, status: true } });
    expect(mocks.lock).toHaveBeenCalledOnce();
  });
  it("preserves question order and effective points", async () => {
    mocks.assessment.mockResolvedValue(startAssessment([assessmentQuestion({ id: "aq2", sortOrder: 1, pointsOverride: 5 }), assessmentQuestion({ id: "aq1", sortOrder: 2 })]));
    const result = await startAssessmentAttempt("a1"); expect(result.questions.map(q => [q.id, q.sortOrder, q.points])).toEqual([["aq2", 1, 5], ["aq1", 2, 2]]);
  });
  it("reuses an existing snapshot without overwriting it", async () => {
    mocks.assessment.mockResolvedValue(startAssessment([assessmentQuestion({ questionSnapshot: snapshot({ text: "نسخة قديمة" }) })]));
    expect((await startAssessmentAttempt("a1")).questions[0].text).toBe("نسخة قديمة"); expect(mocks.snapshot).not.toHaveBeenCalled();
  });
  it.each([[null, "assessment_not_found"], [{ ...startAssessment(), status: "DRAFT" }, "assessment_unavailable"], [{ ...startAssessment(), status: "CLOSED" }, "assessment_unavailable"], [{ ...startAssessment(), status: "ARCHIVED" }, "assessment_unavailable"], [startAssessment([]), "assessment_empty"]] as const)
    ("rejects an unavailable assessment", async (value, code) => { mocks.assessment.mockResolvedValue(value); await expect(startAssessmentAttempt("a1")).rejects.toMatchObject({ code }); });
  it("rejects unsupported question types", async () => {
    mocks.assessment.mockResolvedValue(startAssessment([assessmentQuestion({ question: { ...assessmentQuestion().question, type: "MATCHING" } })]));
    await expect(startAssessmentAttempt("a1")).rejects.toMatchObject({ code: "unsupported_question" });
  });
  it("rejects a duplicate attempt", async () => { mocks.existing.mockResolvedValue({ id: "old" }); await expect(startAssessmentAttempt("a1")).rejects.toMatchObject({ code: "attempt_exists" }); });
  it("maps a concurrent unique conflict", async () => {
    mocks.createAttempt.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "7.10.0" }));
    await expect(startAssessmentAttempt("a1")).rejects.toMatchObject({ code: "attempt_exists" });
  });
  it("uses the authenticated student profile and rejects inactive profiles", async () => {
    await startAssessmentAttempt("a1"); expect(mocks.student).toHaveBeenCalledWith({ where: { userId: "user-1" }, select: { id: true, isActive: true } });
    mocks.student.mockResolvedValue({ id: "student-1", isActive: false }); await expect(startAssessmentAttempt("a1")).rejects.toMatchObject({ code: "student_not_found" });
  });
  it("propagates a nested write failure for transaction rollback", async () => {
    const failure = new Error("write failed"); mocks.createAttempt.mockRejectedValue(failure); await expect(startAssessmentAttempt("a1")).rejects.toBe(failure);
    await expect(mocks.transaction.mock.results[0].value).rejects.toBe(failure);
  });
});

describe("saveAssessmentAnswer", () => {
  const attempt = (patch: Record<string, unknown> = {}) => ({ id: "attempt-1", studentId: "student-1", status: "IN_PROGRESS", assessment: { questions: [{ id: "aq1", questionSnapshot: snapshot() }] }, ...patch });
  beforeEach(() => mocks.existing.mockResolvedValue(attempt()));
  it.each(["o1", "o2"])("saves or updates one selected option %s idempotently", async optionId => {
    expect(await saveAssessmentAnswer("attempt-1", "aq1", { optionId })).toMatchObject({ assessmentQuestionId: "aq1", selectedOptionId: optionId, answered: true });
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { attemptId_assessmentQuestionId: { attemptId: "attempt-1", assessmentQuestionId: "aq1" } },
      create: expect.objectContaining({ answerPayload: { optionId } }), update: expect.objectContaining({ answerPayload: { optionId } }) }));
  });
  it("saves a TRUE_FALSE option from its fixed snapshot", async () => {
    const trueFalse = snapshot({ type: "TRUE_FALSE", options: [{ optionId: "true", text: "صحيح", sortOrder: 1, isCorrect: false }, { optionId: "false", text: "خطأ", sortOrder: 2, isCorrect: true }] });
    mocks.existing.mockResolvedValue(attempt({ assessment: { questions: [{ id: "aq1", questionSnapshot: trueFalse }] } }));
    await expect(saveAssessmentAnswer("attempt-1", "aq1", { optionId: "false" })).resolves.toMatchObject({ selectedOptionId: "false" });
  });
  it("rejects an option outside the snapshot", async () => { await expect(saveAssessmentAnswer("attempt-1", "aq1", { optionId: "other" })).rejects.toMatchObject({ code: "option_not_found" }); });
  it("rejects a question outside the attempt", async () => { mocks.existing.mockResolvedValue(attempt({ assessment: { questions: [] } })); await expect(saveAssessmentAnswer("attempt-1", "other", { optionId: "o1" })).rejects.toMatchObject({ code: "attempt_question_not_found" }); });
  it("hides another student's attempt", async () => { mocks.existing.mockResolvedValue(attempt({ studentId: "student-2" })); await expect(saveAssessmentAnswer("attempt-1", "aq1", { optionId: "o1" })).rejects.toMatchObject({ code: "attempt_not_found" }); });
  it("rejects changes after submit", async () => { mocks.existing.mockResolvedValue(attempt({ status: "GRADED" })); await expect(saveAssessmentAnswer("attempt-1", "aq1", { optionId: "o1" })).rejects.toMatchObject({ code: "attempt_submitted" }); });
  it.each([null, [], {}, { optionId: "o1", studentId: "forged" }])("validates answer bodies %j", async body => { await expect(saveAssessmentAnswer("attempt-1", "aq1", body)).rejects.toThrow(); expect(mocks.upsert).not.toHaveBeenCalled(); });
});

describe("submitAssessmentAttempt", () => {
  function submission(answers: { id: string; assessmentQuestionId: string; answerPayload: { optionId: string } }[], second = snapshot({ questionId: "q2", points: 3 })) {
    return { id: "attempt-1", studentId: "student-1", status: "IN_PROGRESS", assessment: { id: "a1", title: "اختبار", questions: [
      { id: "aq1", questionSnapshot: snapshot() }, { id: "aq2", questionSnapshot: second },
    ] }, answers };
  }
  it("grades mixed answers with full or zero credit", async () => {
    mocks.existing.mockResolvedValue(submission([{ id: "ans1", assessmentQuestionId: "aq1", answerPayload: { optionId: "o1" } }, { id: "ans2", assessmentQuestionId: "aq2", answerPayload: { optionId: "o2" } }]));
    const result = await submitAssessmentAttempt("attempt-1");
    expect(result).toMatchObject({ earnedPoints: 2, totalPoints: 5, percentage: 40, correctCount: 1, questionCount: 2, status: "GRADED" });
    expect(result.questionResults.map(r => [r.correct, r.awardedPoints])).toEqual([[true, 2], [false, 0]]);
    expect(mocks.updateAttempt).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "GRADED", score: 2, maxScore: 5 }) }));
  });
  it("allows unanswered questions and awards zero", async () => {
    mocks.existing.mockResolvedValue(submission([])); const result = await submitAssessmentAttempt("attempt-1");
    expect(result.earnedPoints).toBe(0); expect(result.percentage).toBe(0); expect(result.questionResults.every(r => !r.answered && !r.correct)).toBe(true); expect(mocks.updateAnswer).not.toHaveBeenCalled();
  });
  it("grades all-correct answers", async () => {
    mocks.existing.mockResolvedValue(submission([{ id: "x", assessmentQuestionId: "aq1", answerPayload: { optionId: "o1" } }, { id: "y", assessmentQuestionId: "aq2", answerPayload: { optionId: "o1" } }]));
    expect(await submitAssessmentAttempt("attempt-1")).toMatchObject({ earnedPoints: 5, totalPoints: 5, percentage: 100, correctCount: 2 });
  });
  it("awards zero for answered but incorrect questions", async () => {
    mocks.existing.mockResolvedValue(submission([{ id: "x", assessmentQuestionId: "aq1", answerPayload: { optionId: "o2" } }, { id: "y", assessmentQuestionId: "aq2", answerPayload: { optionId: "o2" } }]));
    const result = await submitAssessmentAttempt("attempt-1"); expect(result).toMatchObject({ earnedPoints: 0, totalPoints: 5, percentage: 0, correctCount: 0 }); expect(result.questionResults.every(item => item.answered && !item.correct && item.awardedPoints === 0)).toBe(true);
  });
  it("uses snapshot correctness after the question bank could change", async () => {
    mocks.existing.mockResolvedValue(submission([{ id: "x", assessmentQuestionId: "aq1", answerPayload: { optionId: "o1" } }]));
    const result = await submitAssessmentAttempt("attempt-1"); expect(result.questionResults[0].correct).toBe(true);
    expect(mocks.assessment).not.toHaveBeenCalled();
  });
  it("allows an active attempt to finish after its assessment is closed", async () => {
    mocks.existing.mockResolvedValue(submission([{ id: "x", assessmentQuestionId: "aq1", answerPayload: { optionId: "o1" } }]));
    const result = await submitAssessmentAttempt("attempt-1");
    expect(result.status).toBe("GRADED");
    expect(mocks.assessment).not.toHaveBeenCalled();
  });
  it("locks before grading and rejects repeat submit", async () => {
    mocks.existing.mockResolvedValue(submission([])); await submitAssessmentAttempt("attempt-1"); expect(mocks.lock).toHaveBeenCalledOnce();
    mocks.existing.mockResolvedValue({ ...submission([]), status: "GRADED" }); await expect(submitAssessmentAttempt("attempt-1")).rejects.toMatchObject({ code: "attempt_submitted" });
  });
  it("rejects IDOR without grading", async () => { mocks.existing.mockResolvedValue({ ...submission([]), studentId: "student-2" }); await expect(submitAssessmentAttempt("attempt-1")).rejects.toMatchObject({ code: "attempt_not_found" }); expect(mocks.updateAttempt).not.toHaveBeenCalled(); });
});
