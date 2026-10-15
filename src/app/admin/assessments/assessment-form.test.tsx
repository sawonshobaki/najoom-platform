// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AssessmentCreationData } from "@/lib/assessments/assessment-service";
const mocks = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));
import { AssessmentForm, reorderQuestionIds } from "./assessment-form";

const data = { curriculum: [{ id: "g", name: "الصف السادس", semesters: [{ id: "s", name: "الفصل الدراسي الأول", academicYear: "2026-2027", units: [{ id: "u", title: "من الخلية إلى الجسم", lessons: [{ id: "l1", title: "الخلية" }, { id: "l2", title: "درس آخر" }] }] }] }],
  questions: [
    { id: "q1", lessonId: "l1", text: "ما الخلية؟", type: "MULTIPLE_CHOICE", difficulty: "EASY", points: 2 },
    { id: "q2", lessonId: "l1", text: "الخلية وحدة البناء.", type: "TRUE_FALSE", difficulty: "MEDIUM", points: 1 },
    { id: "q3", lessonId: "l2", text: "سؤال من درس آخر", type: "TRUE_FALSE", difficulty: "HARD", points: 5 },
  ] } as AssessmentCreationData;

async function chooseLesson(user: ReturnType<typeof userEvent.setup>, lesson = "l1") {
  await user.selectOptions(screen.getByLabelText("الصف"), "g");
  await user.selectOptions(screen.getByLabelText("الفصل الدراسي"), "s");
  await user.selectOptions(screen.getByLabelText("الوحدة"), "u");
  await user.selectOptions(screen.getByLabelText("الدرس"), lesson);
}

beforeEach(() => { vi.resetAllMocks(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("assessment creation form", () => {
  it("uses RTL, accessible labels and a disabled submit initially", () => {
    render(<AssessmentForm {...data} />);
    expect(screen.getByRole("form", { name: "إنشاء اختبار" }).getAttribute("dir")).toBe("rtl");
    for (const label of ["عنوان الاختبار", "الصف", "الفصل الدراسي", "الوحدة", "الدرس"]) expect(screen.getByLabelText(label)).toBeTruthy();
    expect((screen.getByRole("button", { name: "حفظ الاختبار" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("اختاري درسًا لعرض أسئلته.")).toBeTruthy();
  });
  it("shows only questions from the selected lesson and summarizes selection", async () => {
    const user = userEvent.setup(); render(<AssessmentForm {...data} />); await chooseLesson(user);
    expect(screen.getByText("ما الخلية؟")).toBeTruthy(); expect(screen.getByText("الخلية وحدة البناء.")).toBeTruthy();
    expect(screen.queryByText("سؤال من درس آخر")).toBeNull();
    await user.click(screen.getByRole("checkbox", { name: /ما الخلية/ }));
    await user.click(screen.getByRole("checkbox", { name: /الخلية وحدة البناء/ }));
    expect(screen.getByText("عدد الأسئلة: 2 · مجموع النقاط: 3")).toBeTruthy();
    expect((screen.getByRole("button", { name: "حفظ الاختبار" }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("clears selected questions when the lesson changes", async () => {
    const user = userEvent.setup(); render(<AssessmentForm {...data} />); await chooseLesson(user);
    await user.click(screen.getByRole("checkbox", { name: /ما الخلية/ }));
    await user.selectOptions(screen.getByLabelText("الدرس"), "l2");
    expect(screen.getByText("عدد الأسئلة: 0 · مجموع النقاط: 0")).toBeTruthy(); expect(screen.getByText("سؤال من درس آخر")).toBeTruthy();
  });
  it("shows the required empty lesson message", async () => {
    const user = userEvent.setup(); render(<AssessmentForm {...data} questions={[]} />); await chooseLesson(user);
    expect(screen.getByText("لا توجد أسئلة متاحة لهذا الدرس حتى الآن.")).toBeTruthy();
  });
  it("reorders selected IDs deterministically", () => {
    expect(reorderQuestionIds(["q1", "q2", "q3"], "q2", -1)).toEqual(["q2", "q1", "q3"]);
    expect(reorderQuestionIds(["q1", "q2"], "q1", -1)).toEqual(["q1", "q2"]);
  });
  it("submits only the public contract in selected order", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, assessment: { id: "a1" } }) });
    vi.stubGlobal("fetch", fetchMock); const user = userEvent.setup(); render(<AssessmentForm {...data} />); await chooseLesson(user);
    await user.type(screen.getByLabelText("عنوان الاختبار"), "اختبار الخلية");
    await user.click(screen.getByRole("checkbox", { name: /ما الخلية/ })); await user.click(screen.getByRole("checkbox", { name: /الخلية وحدة البناء/ }));
    const downButtons = screen.getAllByRole("button", { name: "تحريك لأسفل" }); fireEvent.click(downButtons[0]);
    await user.click(screen.getByRole("button", { name: "حفظ الاختبار" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const request = fetchMock.mock.calls[0][1];
    expect(JSON.parse(request.body)).toEqual({ title: "اختبار الخلية", lessonId: "l1", questionIds: ["q2", "q1"] });
    expect(JSON.parse(request.body)).not.toHaveProperty("gradeId"); expect(JSON.parse(request.body)).not.toHaveProperty("type"); expect(JSON.parse(request.body)).not.toHaveProperty("durationSeconds");
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/admin/assessments"));
  });
});
