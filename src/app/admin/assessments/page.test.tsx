import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({ list: vi.fn(), creation: vi.fn(), results: vi.fn() }));
vi.mock("@/lib/assessments/assessment-service", () => ({ listAssessments: mocks.list, getAssessmentCreationData: mocks.creation }));
vi.mock("@/lib/assessments/assessment-results-service", () => ({ getAssessmentResults: mocks.results }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
import AssessmentsPage from "./page";
import NewAssessmentPage from "./new/page";
import AssessmentResultsPage from "./[assessmentId]/results/page";

beforeEach(() => { vi.resetAllMocks(); mocks.list.mockResolvedValue([]); mocks.creation.mockResolvedValue({ curriculum: [], questions: [] }); mocks.results.mockResolvedValue({ id: "a1", title: "اختبار الخلية", status: "PUBLISHED", lesson: { id: "l1", title: "الخلية" }, questionCount: 2, maxScore: 5, totalAttempts: 0, gradedAttempts: 0, averageScore: null, averagePercentage: null, attempts: [] }); });

describe("assessment admin pages", () => {
  it("renders the RTL list empty state and creation link", async () => {
    const html = renderToStaticMarkup(await AssessmentsPage());
    expect(html).toContain('dir="rtl"'); expect(html).toContain("الاختبارات"); expect(html).toContain("لا توجد اختبارات حتى الآن.");
    expect(html).toContain('href="/admin/assessments/new"'); expect(html).toContain("عدد الاختبارات: 0");
  });
  it("renders curriculum path, counts, points, status and date", async () => {
    mocks.list.mockResolvedValue([{ id: "a1", title: "اختبار الخلية", status: "DRAFT", questionCount: 2, totalPoints: 3, createdAt: new Date("2026-10-15T00:00:00Z"),
      lesson: { title: "الخلية", unit: { title: "من الخلية إلى الجسم", semester: { name: "الفصل الأول", academicYear: "2026-2027", grade: { name: "الصف السادس" } } } } }]);
    const html = renderToStaticMarkup(await AssessmentsPage());
    for (const value of ["اختبار الخلية", "الصف السادس", "الفصل الأول", "من الخلية إلى الجسم", "الخلية", "الأسئلة: 2", "مجموع النقاط: 3", "مسودة"]) expect(html).toContain(value);
    expect(html).toContain('<bdi dir="ltr" class="whitespace-nowrap">(2026-2027)</bdi>');
    expect(html).toContain("نشر الاختبار"); expect(html).not.toContain("إغلاق الاختبار"); expect(html).toContain("عرض النتائج");
  });
  it("renders the protected creation page and loads its data", async () => {
    const html = renderToStaticMarkup(await NewAssessmentPage());
    expect(html).toContain('dir="rtl"'); expect(html).toContain("إنشاء اختبار"); expect(html).toContain('href="/admin/assessments"'); expect(mocks.creation).toHaveBeenCalledOnce();
  });
  it("shows only the valid close action for published assessments", async () => {
    mocks.list.mockResolvedValue([{ id: "a1", title: "منشور", status: "PUBLISHED", questionCount: 1, totalPoints: 2, createdAt: new Date(), lesson: { title: "الخلية", unit: { title: "الوحدة", semester: { name: "الفصل", academicYear: "2026-2027", grade: { name: "السادس" } } } } }]);
    const html = renderToStaticMarkup(await AssessmentsPage()); expect(html).toContain("إغلاق الاختبار"); expect(html).not.toContain("نشر الاختبار");
  });
  it("renders an RTL empty results page without leaking answers", async () => {
    const html = renderToStaticMarkup(await AssessmentResultsPage({ params: Promise.resolve({ assessmentId: "a1" }) }));
    expect(html).toContain('dir="rtl"'); expect(html).toContain("نتائج: اختبار الخلية"); expect(html).toContain("لا توجد نتائج لهذا الاختبار حتى الآن.");
    expect(html).not.toMatch(/isCorrect|questionSnapshot|مفتاح الإجابة/);
  });
  it("renders responsive populated result cards", async () => {
    mocks.results.mockResolvedValue({ ...await mocks.results(), totalAttempts: 1, gradedAttempts: 1, averageScore: 4, averagePercentage: 80, attempts: [{ id: "t1", status: "GRADED", startedAt: new Date(), submittedAt: new Date("2026-10-15T00:05:00Z"), score: 4, maxScore: 5, percentage: 80, student: { id: "s1", fullName: "سارة أحمد" } }] });
    const html = renderToStaticMarkup(await AssessmentResultsPage({ params: Promise.resolve({ assessmentId: "a1" }) }));
    for (const value of ["سارة أحمد", "4 من 5", "80%", "مصححة", "متوسط النسبة"]) expect(html).toContain(value);
    expect(html).toContain("grid-cols-2");
  });
});
