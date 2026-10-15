import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({ list: vi.fn(), creation: vi.fn() }));
vi.mock("@/lib/assessments/assessment-service", () => ({ listAssessments: mocks.list, getAssessmentCreationData: mocks.creation }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
import AssessmentsPage from "./page";
import NewAssessmentPage from "./new/page";

beforeEach(() => { vi.resetAllMocks(); mocks.list.mockResolvedValue([]); mocks.creation.mockResolvedValue({ curriculum: [], questions: [] }); });

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
  });
  it("renders the protected creation page and loads its data", async () => {
    const html = renderToStaticMarkup(await NewAssessmentPage());
    expect(html).toContain('dir="rtl"'); expect(html).toContain("إنشاء اختبار"); expect(html).toContain('href="/admin/assessments"'); expect(mocks.creation).toHaveBeenCalledOnce();
  });
});
