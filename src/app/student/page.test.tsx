import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({ dashboard: vi.fn() }));
vi.mock("@/lib/student-dashboard/student-dashboard-service", () => ({ getStudentDashboardData: mocks.dashboard }));
vi.mock("@/components/oula/oula-guide", () => ({ OulaGuide: ({ studentName }: { studentName?: string }) => <aside aria-label="عُلا">عُلا مع {studentName}</aside> }));
import StudentHomePage from "./page";

const data = (patch: Record<string, unknown> = {}) => ({
  student: { fullName: "سارة أحمد", section: { id: "sec1", name: "أ" }, grade: { id: "g6", name: "الصف السادس" } },
  assignments: [{ id: "hw1", title: "واجب الخلية الطويل", lessonTitle: "الخلية", externalUrl: "https://example.edu/task", weekNumber: 3, score: 1 }],
  availableAssessments: [{ id: "as1", title: "اختبار الخلية", lessonTitle: "الخلية", questionCount: 4 }],
  recentResults: [{ id: "at1", assessmentId: "as2", title: "اختبار المادة", score: 4, maxScore: 5, percentage: 80, submittedAt: new Date("2026-10-15T10:00:00Z") }],
  summary: { completedAssessments: 1, assessmentAverage: 80, assignmentEarnedPoints: 1, gradedAssignments: 1 }, ...patch,
});

beforeEach(() => { vi.resetAllMocks(); mocks.dashboard.mockResolvedValue(data()); });

describe("student dashboard page", () => {
  it("renders an accessible RTL welcome, profile, and quick actions", async () => {
    const html = renderToStaticMarkup(await StudentHomePage());
    expect(html).toContain('dir="rtl"'); expect(html).toContain("أهلًا سارة أحمد"); expect(html).toContain("الصف السادس"); expect(html).toContain("الشعبة أ");
    expect(html).toContain('aria-label="روابط سريعة"'); expect(html).toContain('href="/student/assignments"'); expect(html).toContain('href="#available-assessments"');
  });
  it("renders assignment, assessment, result, and summary cards safely", async () => {
    const html = renderToStaticMarkup(await StudentHomePage());
    for (const text of ["واجب الخلية الطويل", "1 نقطة", "اختبار الخلية", "عدد الأسئلة: 4", "اختبار المادة", "اختبارات مكتملة", "80%", "1 من 1"]) expect(html).toContain(text);
    expect(html).toContain('target="_blank"'); expect(html).toContain('rel="noopener noreferrer"'); expect(html).toContain('href="/student/assessments/as1"');
  });
  it.each([[1, "1 نقطة"], [0, "0 نقطة"], [null, "لم يتم التقييم بعد"]] as const)("shows assignment score state %s", async (score, label) => {
    mocks.dashboard.mockResolvedValue(data({ assignments: [{ ...data().assignments[0], score }] }));
    expect(renderToStaticMarkup(await StudentHomePage())).toContain(label);
  });
  it("renders all empty states without looking like an error", async () => {
    mocks.dashboard.mockResolvedValue(data({ assignments: [], availableAssessments: [], recentResults: [], summary: { completedAssessments: 0, assessmentAverage: 0, assignmentEarnedPoints: 0, gradedAssignments: 0 } }));
    const html = renderToStaticMarkup(await StudentHomePage());
    for (const text of ["لا توجد واجبات متاحة حاليًا.", "لا توجد اختبارات متاحة حاليًا.", "لا توجد نتائج بعد."]) expect(html).toContain(text);
  });
  it("renders the no-section state while keeping the dashboard available", async () => {
    mocks.dashboard.mockResolvedValue(data({ student: { fullName: "سارة أحمد", section: null, grade: null }, assignments: [], availableAssessments: [], recentResults: [] }));
    const html = renderToStaticMarkup(await StudentHomePage()); expect(html).toContain("لم يتم تعيين شعبة لكِ بعد."); expect(html).toContain("ملخص تقدّمكِ");
  });
});
