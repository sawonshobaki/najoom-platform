// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StudentAssessmentAttempt } from "./student-assessment-attempt";

const attempt = { attemptId: "t1", status: "IN_PROGRESS", startedAt: "2026-10-15T00:00:00Z", assessment: { id: "a1", title: "اختبار الخلية", durationSeconds: 0, lesson: { id: "l1", title: "الخلية" } }, questions: [
  { id: "aq1", sortOrder: 1, text: "ما وحدة البناء؟", type: "MULTIPLE_CHOICE", points: 2, options: [{ id: "o1", text: "الخلية", sortOrder: 1 }, { id: "o2", text: "النسيج", sortOrder: 2 }] },
  { id: "aq2", sortOrder: 2, text: "الخلية وحدة البناء.", type: "TRUE_FALSE", points: 1, options: [{ id: "o3", text: "صحيح", sortOrder: 1 }, { id: "o4", text: "خطأ", sortOrder: 2 }] },
] };
const result = { attemptId: "t1", assessmentId: "a1", title: "اختبار الخلية", status: "GRADED", submittedAt: "2026-10-15T00:05:00Z", earnedPoints: 2, totalPoints: 3, percentage: 66.67, correctCount: 1, questionCount: 2,
  questionResults: [{ assessmentQuestionId: "aq1", answered: true, correct: true, awardedPoints: 2, points: 2, correctOption: { id: "o1", text: "الخلية" } }, { assessmentQuestionId: "aq2", answered: false, correct: false, awardedPoints: 0, points: 1, correctOption: { id: "o3", text: "صحيح" } }] };
const json = (body: object, ok = true) => Promise.resolve({ ok, json: async () => body } as Response);

beforeEach(() => { vi.restoreAllMocks(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("student assessment experience", () => {
  it("starts with an accessible untimed call to action", () => { render(<StudentAssessmentAttempt assessmentId="a1" />); expect(screen.getByRole("heading", { name: "الاختبار" })).toBeTruthy(); expect(screen.getByText(/غير موقّت/)).toBeTruthy(); expect(screen.getByRole("button", { name: "ابدئي الاختبار" })).toBeTruthy(); });
  it("renders ordered questions and radio options without an answer key", async () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(json({ success: true, attempt }))); const user = userEvent.setup(); render(<StudentAssessmentAttempt assessmentId="a1" />); await user.click(screen.getByRole("button", { name: "ابدئي الاختبار" }));
    expect(await screen.findByRole("heading", { name: "اختبار الخلية" })).toBeTruthy(); expect(screen.getAllByRole("radio")).toHaveLength(4); expect(screen.getByRole("group", { name: /ما وحدة البناء.*2 نقطة/ })).toBeTruthy();
    expect(screen.queryByText(/الإجابة الصحيحة/)).toBeNull(); expect(screen.queryByText(/correctOption|isCorrect/)).toBeNull();
  });
  it("saves a choice and shows answered state", async () => {
    const fetchMock = vi.fn().mockReturnValueOnce(json({ success: true, attempt })).mockReturnValueOnce(json({ success: true, answer: { answered: true } })); vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup(); render(<StudentAssessmentAttempt assessmentId="a1" />); await user.click(screen.getByRole("button", { name: "ابدئي الاختبار" })); await user.click(await screen.findByRole("radio", { name: "الخلية" }));
    expect(await screen.findByText("تم حفظ الإجابة")).toBeTruthy(); expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ optionId: "o1" }); expect(fetchMock.mock.calls[1][1].method).toBe("PUT");
  });
  it("requires confirmation and permits submitting unanswered questions", async () => {
    const fetchMock = vi.fn().mockReturnValueOnce(json({ success: true, attempt })).mockReturnValueOnce(json({ success: true, result })); vi.stubGlobal("fetch", fetchMock); vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup(); render(<StudentAssessmentAttempt assessmentId="a1" />); await user.click(screen.getByRole("button", { name: "ابدئي الاختبار" })); await user.click(await screen.findByRole("button", { name: "تسليم الاختبار" }));
    expect(window.confirm).toHaveBeenCalledOnce(); expect(await screen.findByRole("heading", { name: "نتيجة الاختبار" })).toBeTruthy(); expect(screen.getByText("2 من 3 نقطة")).toBeTruthy(); expect(screen.getByText("الإجابات الصحيحة: 1 من 2")).toBeTruthy(); expect(screen.getByText(/السؤال 2: بلا إجابة/)).toBeTruthy();
  });
  it("does not submit after cancelling confirmation", async () => {
    const fetchMock = vi.fn().mockReturnValueOnce(json({ success: true, attempt })); vi.stubGlobal("fetch", fetchMock); vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup(); render(<StudentAssessmentAttempt assessmentId="a1" />); await user.click(screen.getByRole("button", { name: "ابدئي الاختبار" })); await user.click(await screen.findByRole("button", { name: "تسليم الاختبار" })); await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
  it("shows safe Arabic API errors", async () => { vi.stubGlobal("fetch", vi.fn().mockReturnValue(json({ success: false, message: "هذا الاختبار غير متاح للبدء." }, false))); const user = userEvent.setup(); render(<StudentAssessmentAttempt assessmentId="a1" />); await user.click(screen.getByRole("button", { name: "ابدئي الاختبار" })); expect((await screen.findByRole("alert")).textContent).toContain("هذا الاختبار غير متاح للبدء."); });
});
