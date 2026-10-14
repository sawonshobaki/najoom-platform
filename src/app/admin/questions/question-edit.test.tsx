import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { QuestionDetail } from "@/lib/questions/question-service";
const m = vi.hoisted(() => ({ get: vi.fn(), data: vi.fn() }));
vi.mock("@/lib/questions/question-service", () => ({ getQuestion: m.get, getQuestionCreationData: m.data, QuestionMutationError: class extends Error {} }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), notFound: () => { throw Error("not found"); } }));
import EditPage from "./[questionId]/edit/page";
import { QuestionForm } from "./question-form";
import { QuestionDeleteButton } from "./question-delete-button";
import { questionUpdatePayload } from "./question-form-state";
const question = (type: "MULTIPLE_CHOICE" | "TRUE_FALSE" = "MULTIPLE_CHOICE"): QuestionDetail => ({
  id: "q", text: "نص السؤال", explanation: "شرح الإجابة", difficulty: "MEDIUM", type, source: "MANUAL", status: "DRAFT", createdAt: new Date(), points: 1, isUsed: false,
  lesson: { id: "l", title: "الخلية", unit: { id: "u", title: "من الخلية إلى الجسم", semester: { id: "s", name: "الفصل الأول", academicYear: "2026-2027", grade: { id: "g", name: "الصف السادس" } } } }, learningObjective: null,
  options: [{ id: "a", text: type === "TRUE_FALSE" ? "صحيح" : "أ", sortOrder: 1, isCorrect: true }, { id: "b", text: type === "TRUE_FALSE" ? "خطأ" : "ب", sortOrder: 2, isCorrect: false }],
});
beforeEach(() => { vi.resetAllMocks(); m.get.mockResolvedValue(question()); m.data.mockResolvedValue({ curriculum: [], objectives: [] }); });
it("loads the edit page with fixed curriculum and type, labelled editable fields and RTL", async () => {
  const html = renderToStaticMarkup(await EditPage({ params: Promise.resolve({ questionId: "q" }) }));
  for (const text of ["تعديل السؤال", "الصف السادس", "الفصل الأول", "من الخلية إلى الجسم", "الخلية", "اختيار من متعدد", "حفظ التعديلات"]) expect(html).toContain(text);
  expect(html).toContain('dir="rtl"'); expect(html).not.toContain('value="MULTIPLE_CHOICE"'); expect(html).not.toContain('value="l"');
  expect(html).toContain('<bdi dir="ltr" class="whitespace-nowrap">(2026-2027)</bdi>');
  for (const id of [...html.matchAll(/<(?:input|select|textarea)[^>]*\bid="([^"]+)"/g)].map(m => m[1])) expect(html).toContain(`for="${id}"`);
});
it("renders TRUE_FALSE as fixed labels and radios only", () => {
  const html = renderToStaticMarkup(<QuestionForm curriculum={[]} objectives={[]} question={question("TRUE_FALSE")} />);
  expect(html).toContain("صحيح"); expect(html).toContain("خطأ"); expect(html.match(/type="radio"/g)).toHaveLength(2); expect(html).not.toContain("إضافة خيار"); expect(html).toContain('checked="" value="true"');
});
it("blocks the used page and shared form", async () => {
  const used = { ...question(), isUsed: true }; m.get.mockResolvedValue(used);
  for (const html of [renderToStaticMarkup(await EditPage({ params: Promise.resolve({ questionId: "q" }) })), renderToStaticMarkup(<QuestionForm curriculum={[]} objectives={[]} question={used} />)]) {
    expect(html).toContain("مستخدم في تقييم"); expect(html).not.toContain("<form");
  }
  expect(m.data).not.toHaveBeenCalled();
});
it("disables delete for used questions and provides accessible feedback space", () => {
  const html = renderToStaticMarkup(<QuestionDeleteButton questionId="q" isUsed />); expect(html).toContain('disabled=""'); expect(html).toContain("مستخدم في تقييم");
});
it.each(["MULTIPLE_CHOICE", "TRUE_FALSE"] as const)("omits readonly fields from %s PATCH payload", type => {
  const shared = { lessonId: "l", text: "سؤال", difficulty: "MEDIUM" as const };
  const result = questionUpdatePayload(type === "TRUE_FALSE" ? { ...shared, type, correctAnswer: false } : { ...shared, type, options: [{ text: "أ", isCorrect: true }, { text: "ب", isCorrect: false }] });
  expect(result).not.toHaveProperty("lessonId"); expect(result).not.toHaveProperty("type"); expect(result).toHaveProperty(type === "TRUE_FALSE" ? "correctAnswer" : "options");
});
