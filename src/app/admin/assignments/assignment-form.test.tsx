// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const mocks = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));
import { AssignmentForm } from "./assignment-form";

const curriculum = [{ id: "g6", name: "الصف السادس", semesters: [{ id: "s1", name: "الفصل الأول", academicYear: "2026-2027", units: [{ id: "u1", title: "الوحدة", lessons: [{ id: "l1", title: "الخلية" }] }] }] }];
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: true, assignment: { id: "a1" } }), { status: 201, headers: { "Content-Type": "application/json" } }))); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("عنوان الواجب"), "واجب الخلية");
  await user.selectOptions(screen.getByLabelText("الصف"), "g6"); await user.selectOptions(screen.getByLabelText("الفصل الدراسي"), "s1"); await user.selectOptions(screen.getByLabelText("الوحدة"), "u1"); await user.selectOptions(screen.getByLabelText("الدرس"), "l1");
  await user.clear(screen.getByLabelText("رقم الأسبوع")); await user.type(screen.getByLabelText("رقم الأسبوع"), "3"); await user.type(screen.getByLabelText("رابط الواجب"), "https://example.edu/task");
}

describe("AssignmentForm", () => {
  it("submits title-only with null description and public fields only", async () => { const user = userEvent.setup(); render(<AssignmentForm curriculum={curriculum} />); await fillRequired(user); await user.click(screen.getByRole("button", { name: "حفظ الواجب" })); await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/admin/assignments")); const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string); expect(body).toEqual({ lessonId: "l1", title: "واجب الخلية", description: null, externalUrl: "https://example.edu/task", weekNumber: 3 }); expect(body).not.toHaveProperty("createdById"); });
  it("submits optional assignment instructions", async () => { const user = userEvent.setup(); render(<AssignmentForm curriculum={curriculum} />); await fillRequired(user); await user.type(screen.getByLabelText(/تعليمات الواجب/), "اقرئي ثم أجيبي"); await user.click(screen.getByRole("button", { name: "حفظ الواجب" })); await waitFor(() => expect(fetch).toHaveBeenCalledOnce()); expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string).description).toBe("اقرئي ثم أجيبي"); });
  it("validates title, week, and HTTPS URL accessibly", async () => { const user = userEvent.setup(); render(<AssignmentForm curriculum={curriculum} />); await user.click(screen.getByRole("button", { name: "حفظ الواجب" })); expect(await screen.findByText("عنوان الواجب مطلوب.")).toBeTruthy(); expect(fetch).not.toHaveBeenCalled(); });
  it("clears dependent curriculum selections when a parent changes", async () => { const user = userEvent.setup(); render(<AssignmentForm curriculum={curriculum} />); await user.selectOptions(screen.getByLabelText("الصف"), "g6"); await user.selectOptions(screen.getByLabelText("الفصل الدراسي"), "s1"); await user.selectOptions(screen.getByLabelText("الوحدة"), "u1"); await user.selectOptions(screen.getByLabelText("الدرس"), "l1"); await user.selectOptions(screen.getByLabelText("الصف"), ""); expect((screen.getByLabelText("الفصل الدراسي") as HTMLSelectElement).value).toBe(""); expect((screen.getByLabelText("الدرس") as HTMLSelectElement).value).toBe(""); });
});
