import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({ data: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/questions/question-service", () => ({ getQuestionCreationData: mocks.data }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));
import NewQuestionPage from "./new/page";
import { QuestionForm, TrueFalseAnswer } from "./question-form";
import { buildQuestionCreatePayload, initialQuestionOptions, questionOptionPayload, questionOptionsReducer as reduce } from "./question-form-state";
import { validateQuestionCreateRequest } from "@/lib/questions/question-validation";
const data = { curriculum: [{ id: "g", name: "الصف السادس", semesters: [{ id: "s", name: "الفصل الأول", academicYear: "2026-2027", units: [
  { id: "u", title: "من الخلية إلى الجسم", lessons: [{ id: "l", title: "الخلية" }] },
] }] }], objectives: [] };
beforeEach(() => { vi.resetAllMocks(); mocks.data.mockResolvedValue(data); });
describe("MCQ creation form", () => {
  it("renders the protected server page with its title and return link", async () => {
    const html = renderToStaticMarkup(await NewQuestionPage());
    expect(html).toContain("إضافة سؤال"); expect(html).toContain('href="/admin/questions"'); expect(mocks.data).toHaveBeenCalledOnce();
  });
  it("propagates authorization errors from the creation data service", async () => {
    mocks.data.mockRejectedValue(new Error("forbidden")); await expect(NewQuestionPage()).rejects.toThrow("forbidden");
  });
  it("renders RTL with associated labels, curriculum selectors and optional objective", () => {
    const html = renderToStaticMarkup(<QuestionForm {...data} />);
    expect(html).toContain('dir="rtl"'); expect(html).toContain('aria-label="إنشاء سؤال"');
    for (const label of ["الصف", "الفصل الدراسي", "الوحدة", "الدرس", "الهدف التعليمي (اختياري)", "نص السؤال", "شرح الإجابة (اختياري)"]) expect(html).toContain(label);
    expect(html).toContain("بدون هدف تعليمي"); expect(html).not.toContain('role="alert"');
    const ids = [...html.matchAll(/<(?:select|textarea|input)[^>]*\bid="([^"]+)"/g)].map(m => m[1]);
    for (const id of ids) expect(html).toContain(`for="${id}"`);
    expect(html).toContain('value="MEDIUM" selected=""');
  });
  it("starts with two radio choices in one required group", () => {
    const html = renderToStaticMarkup(<QuestionForm {...data} />);
    const radios = [...html.matchAll(/<input[^>]*type="radio"[^>]*>/g)].map(m => m[0]);
    expect(radios).toHaveLength(2); expect(radios.every(r => r.includes('required=""'))).toBe(true);
    expect(new Set(radios.map(r => r.match(/name="([^"]+)"/)?.[1])).size).toBe(1);
    expect(html).toMatch(/aria-label="حذف الخيار 1" disabled/);
    expect(html).toMatch(/aria-label="حذف الخيار 2" disabled/);
  });
  it("adds options up to six only", () => {
    let options = initialQuestionOptions;
    for (let i = 0; i < 10; i++) options = reduce(options, { type: "add" });
    expect(options).toHaveLength(6); expect(new Set(options.map(o => o.key)).size).toBe(6);
  });
  it("does not remove below two", () => {
    const three = reduce(initialQuestionOptions, { type: "add" });
    const two = reduce(three, { type: "remove", key: 3 }); expect(two).toHaveLength(2);
    expect(reduce(two, { type: "remove", key: 1 })).toBe(two);
  });
  it("radio selection replaces the previous correct answer", () => {
    const options = reduce(reduce(initialQuestionOptions, { type: "correct", key: 1 }), { type: "correct", key: 2 });
    expect(options.map(o => o.isCorrect)).toEqual([false, true]);
  });
  it("moves text and correctness together in either direction", () => {
    const original = reduce(reduce(initialQuestionOptions, { type: "text", key: 1, text: "إجابة" }), { type: "correct", key: 1 });
    const moved = reduce(original, { type: "move", key: 1, direction: 1 });
    expect(moved[1]).toEqual({ key: 1, text: "إجابة", isCorrect: true });
    expect(reduce(moved, { type: "move", key: 1, direction: -1 })).toEqual(original);
    expect(original[0].key).toBe(1);
  });
  it("keeps the order at move boundaries", () => {
    expect(reduce(initialQuestionOptions, { type: "move", key: 1, direction: -1 })).toBe(initialQuestionOptions);
    expect(reduce(initialQuestionOptions, { type: "move", key: 2, direction: 1 })).toBe(initialQuestionOptions);
  });
  it("requires another explicit correct choice after removing the selected option", () => {
    const three = reduce(reduce(initialQuestionOptions, { type: "add" }), { type: "correct", key: 3 });
    expect(reduce(three, { type: "remove", key: 3 }).some(o => o.isCorrect)).toBe(false);
  });
  it("builds the option payload without UI keys or client sortOrder", () => {
    expect(questionOptionPayload(reduce(initialQuestionOptions, { type: "correct", key: 2 })))
      .toEqual([{ text: "", isCorrect: false }, { text: "", isCorrect: true }]);
  });
});

describe("TRUE_FALSE form and type switching", () => {
  const common = { lessonId: "l", text: "سؤال", difficulty: "MEDIUM" as const, learningObjectiveId: null };
  it("offers only the two supported types with MCQ initially selected", () => {
    const html = renderToStaticMarkup(<QuestionForm {...data} />);
    expect(html).toContain("نوع السؤال"); expect(html).toContain('value="MULTIPLE_CHOICE" selected=""'); expect(html).toContain('value="TRUE_FALSE"');
  });
  it.each([true, false])("renders fixed accessible radios for %s without option editing controls", value => {
    const html = renderToStaticMarkup(<TrueFalseAnswer name="answer" value={value} onChange={() => {}} />);
    expect(html).toContain("صحيح"); expect(html).toContain("خطأ");
    expect(html.match(/type="radio"/g)).toHaveLength(2);
    expect(html.match(/checked=""/g)).toHaveLength(1);
    expect(html).toContain(`checked="" value="${value}"`);
    expect(html).not.toContain("<button"); expect(html).not.toContain('type="text"');
    expect(html.match(/<label/g)).toHaveLength(2); expect(html).toContain("<legend");
  });
  it("requires a deliberate answer for TRUE_FALSE", () => {
    expect(() => buildQuestionCreatePayload(common, "TRUE_FALSE", initialQuestionOptions, null)).toThrow();
    expect(renderToStaticMarkup(<TrueFalseAnswer name="answer" value={null} onChange={() => {}} />)).not.toContain('checked=""');
  });
  it.each([true, false])("sends only a boolean for TRUE_FALSE despite stale MCQ options (%s)", correctAnswer => {
    const body = buildQuestionCreatePayload(common, "TRUE_FALSE", initialQuestionOptions, correctAnswer);
    expect(body).toEqual({ ...common, type: "TRUE_FALSE", correctAnswer });
    expect(validateQuestionCreateRequest(body).options).toHaveLength(2);
  });
  it("returns to MCQ without leaking the retained true/false answer", () => {
    const options = [{ key: 1, text: "أ", isCorrect: true }, { key: 2, text: "ب", isCorrect: false }];
    const before = buildQuestionCreatePayload(common, "MULTIPLE_CHOICE", options, null);
    const tf = buildQuestionCreatePayload(common, "TRUE_FALSE", options, false);
    const after = buildQuestionCreatePayload(common, "MULTIPLE_CHOICE", options, false);
    expect(tf).not.toHaveProperty("options"); expect(after).not.toHaveProperty("correctAnswer");
    expect(after).toEqual(before); expect(validateQuestionCreateRequest(after).type).toBe("MULTIPLE_CHOICE");
  });
});
