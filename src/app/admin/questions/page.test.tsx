import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn(), curriculum: vi.fn(), push: vi.fn() }));
vi.mock("@/lib/auth/authorization", () => ({ requireAdmin: mocks.auth }));
vi.mock("@/lib/questions/question-service", () => ({ listQuestions: mocks.list, getQuestionFilterCurriculum: mocks.curriculum }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
import Page from "./page";
import { QuestionFilters } from "./question-filters";
const curriculum = [{ id: "g", name: "الصف السادس", semesters: [{ id: "s", name: "الفصل الأول", academicYear: "2026-2027",
  units: [{ id: "u", title: "الوحدة المحددة", lessons: [{ id: "l", title: "درس محدد" }] }] }] },
{ id: "g2", name: "الصف الخامس", semesters: [{ id: "s2", name: "فصل آخر", academicYear: "2026-2027", units: [] }] }];
const render = async (query: Record<string, string | string[]> = {}) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(query) }));
beforeEach(() => {
  vi.resetAllMocks(); mocks.auth.mockResolvedValue({ id: "admin" }); mocks.curriculum.mockResolvedValue(curriculum);
  mocks.list.mockResolvedValue({ questions: [], total: 0, page: 1, pageSize: 20, totalPages: 0 });
});
describe("question bank read page", () => {
  it("renders the Arabic title and true empty state", async () => {
    const html = await render(); expect(html).toContain("بنك الأسئلة"); expect(html).toContain("لا توجد أسئلة في بنك الأسئلة حتى الآن.");
    expect(html).toContain("عدد النتائج: 0"); expect(html).not.toContain("<form"); expect(html).not.toContain("إنشاء سؤال");
  });
  it("provides RTL and labels for all six filters", async () => {
    const html = await render(); expect(html).toContain('dir="rtl"');
    for (const key of ["gradeId", "semesterId", "unitId", "lessonId", "type", "difficulty"]) {
      expect(html).toContain(`for="question-${key}"`); expect(html).toContain(`id="question-${key}"`);
    }
    expect(html).toContain("sm:grid-cols-2"); expect(html).toContain("min-w-0");
  });
  it("restricts type selectors to V1", async () => {
    const html = await render(); expect(html).toContain("MULTIPLE_CHOICE"); expect(html).toContain("TRUE_FALSE");
    expect(html).not.toMatch(/MULTIPLE_SELECT|SHORT_ANSWER|MATCHING/);
  });
  it("cascades curriculum choices from the selected parent", () => {
    const html = renderToStaticMarkup(<QuestionFilters curriculum={curriculum} query={{ gradeId: "g", page: 1, pageSize: 20 }} />);
    expect(html).toContain("الفصل الأول"); expect(html).toContain("الوحدة المحددة"); expect(html).toContain("درس محدد"); expect(html).not.toContain("فصل آخر");
  });
  it("distinguishes an empty filter result", async () => {
    expect(await render({ lessonId: "l" })).toContain("لا توجد أسئلة تطابق الفلاتر المحددة.");
    expect(mocks.list).toHaveBeenCalledWith({ lessonId: "l", page: 1, pageSize: 20 });
  });
  it("hides pagination when not needed", async () => expect(await render()).not.toContain('aria-label="صفحات الأسئلة"'));
  it("shows pagination preserving filters and page size", async () => {
    mocks.list.mockResolvedValue({ questions: [], total: 45, page: 2, pageSize: 20, totalPages: 3 });
    const html = await render({ page: "2", lessonId: "l", type: "TRUE_FALSE" });
    expect(html).toContain('aria-label="صفحات الأسئلة"'); expect(html).toContain("السابق"); expect(html).toContain("التالي");
    expect(html).toContain("lessonId=l&amp;type=TRUE_FALSE&amp;page=3&amp;pageSize=20");
  });
  it("allows returning from a page beyond the results", async () => {
    const html = await render({ page: "5" }); expect(html).toContain("السابق"); expect(html).not.toContain("التالي");
  });
  it("shows an Arabic validation error without querying", async () => {
    const html = await render({ page: "bad" }); expect(html).toContain('role="alert"'); expect(html).toContain("إعادة ضبط الفلاتر");
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("rejects repeated query parameters", async () => {
    expect(await render({ type: ["TRUE_FALSE", "MULTIPLE_CHOICE"] })).toContain('role="alert"');
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("renders question metadata and curriculum path without answers", async () => {
    mocks.list.mockResolvedValue({ questions: [{ id: "q", text: "سؤال تجريبي للاختبار فقط", type: "TRUE_FALSE", difficulty: "EASY", optionCount: 2,
      learningObjective: { id: "o", title: "هدف الاختبار" }, lesson: { id: "l", title: "الخلية", unit: { title: "من الخلية إلى الجسم", semester: {
        name: "الفصل الأول", academicYear: "2026-2027", grade: { name: "الصف السادس" },
      } } } }], total: 1, page: 1, pageSize: 20, totalPages: 1 });
    const html = await render();
    for (const value of ["سؤال تجريبي للاختبار فقط", "صح أو خطأ", "سهل", "عدد الخيارات: 2", "الخلية", "هدف الاختبار"]) expect(html).toContain(value);
    expect(html).not.toContain("isCorrect");
  });
  it("requires admin before any page data access", async () => {
    mocks.auth.mockRejectedValue(new Error("forbidden")); await expect(render()).rejects.toThrow("forbidden");
    expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.curriculum).not.toHaveBeenCalled();
  });
});
