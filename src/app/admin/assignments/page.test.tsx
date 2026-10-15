import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({ list: vi.fn(), studentList: vi.fn(), creation: vi.fn() }));
vi.mock("@/lib/assignments/assignment-service", () => ({ listAssignments: mocks.list, listStudentAssignments: mocks.studentList, getAssignmentCreationData: mocks.creation }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
import AdminAssignmentsPage from "./page";
import NewAssignmentPage from "./new/page";
import StudentAssignmentsPage from "@/app/student/assignments/page";

const assignment = (patch: Record<string, unknown> = {}) => ({ id: "a1", title: "واجب الخلية", description: "قارني بين الخليتين.", externalUrl: "https://example.edu/a/very/long/assignment/path", weekNumber: 2, score: null, createdAt: new Date("2026-10-15T00:00:00Z"), lesson: { id: "l1", title: "الخلية", unit: { id: "u1", title: "من الخلية إلى الجسم", semester: { id: "s1", name: "الفصل الأول", academicYear: "2026-2027", grade: { id: "g6", name: "الصف السادس" } } } }, ...patch });
beforeEach(() => { vi.resetAllMocks(); mocks.list.mockResolvedValue([]); mocks.studentList.mockResolvedValue([]); mocks.creation.mockResolvedValue([]); });
describe("assignment pages", () => {
  it("renders the admin RTL empty archive", async () => { const html = renderToStaticMarkup(await AdminAssignmentsPage()); expect(html).toContain('dir="rtl"'); expect(html).toContain("الواجبات"); expect(html).toContain("لا توجد واجبات مضافة حتى الآن."); expect(html).toContain('href="/admin/assignments/new"'); });
  it("groups multiple archived assignments by week", async () => { mocks.list.mockResolvedValue([assignment(), assignment({ id: "a2", title: "واجب آخر" }), assignment({ id: "a3", title: "واجب سابق", weekNumber: 1 })]); const html = renderToStaticMarkup(await AdminAssignmentsPage()); expect(html.match(/الأسبوع 2/g)).toHaveLength(1); for (const value of ["واجب الخلية", "واجب آخر", "الأسبوع 1", "الصف السادس", "تعليمات"]) { if (value !== "تعليمات") expect(html).toContain(value); } expect(html).toContain('href="/admin/assignments/a1/reviews"'); expect(html).toContain('target="_blank"'); expect(html).toContain('rel="noopener noreferrer"'); expect(html).toContain("break-all"); });
  it("loads the protected creation form", async () => { const html = renderToStaticMarkup(await NewAssignmentPage()); expect(html).toContain("إضافة واجب"); expect(html).toContain("تعليمات الواجب"); expect(html).toContain("اكتبي المطلوب من الطالبات في هذا الواجب..."); expect(mocks.creation).toHaveBeenCalledOnce(); });
  it("shows instructions to the student before the safe external link", async () => { mocks.studentList.mockResolvedValue([assignment()]); const html = renderToStaticMarkup(await StudentAssignmentsPage()); expect(html).toContain("قارني بين الخليتين."); expect(html.indexOf("قارني بين الخليتين.")).toBeLessThan(html.indexOf("فتح الواجب")); expect(html).toContain('target="_blank"'); expect(html).not.toContain("تسليم"); });
  it("does not render an empty instruction block", async () => { mocks.studentList.mockResolvedValue([assignment({ description: null })]); const html = renderToStaticMarkup(await StudentAssignmentsPage()); expect(html).not.toContain("قارني بين الخليتين."); expect(html).toContain("فتح الواجب"); });
  it.each([[null, "لم يتم التقييم بعد"], [1, "1 نقطة"], [0, "0 نقطة"]] as const)("shows the student's own grade state %s", async (score, label) => { mocks.studentList.mockResolvedValue([assignment({ score })]); const html = renderToStaticMarkup(await StudentAssignmentsPage()); expect(html).toContain(label); expect(html).not.toContain("gradedBy"); });
});
