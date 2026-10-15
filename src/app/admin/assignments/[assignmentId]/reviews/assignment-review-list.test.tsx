// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AssignmentReviewList } from "./assignment-review-list";

const students = [
  { id: "st1", fullName: "سارة أحمد", sectionName: "أ", score: null, gradedAt: null },
  { id: "st2", fullName: "ليان محمد", sectionName: "ب", score: 1 as const, gradedAt: new Date("2026-10-15") },
];

beforeEach(() => vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, grade: { score: 1, gradedAt: "2026-10-15T00:00:00.000Z" } }) })));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("AssignmentReviewList", () => {
  it("renders student, section, and ungraded state accessibly", () => {
    render(<AssignmentReviewList assignmentId="a1" initialStudents={students} />);
    expect(screen.getByText("سارة أحمد")).toBeTruthy();
    expect(screen.getByText("الشعبة: أ")).toBeTruthy();
    expect(screen.getByText("غير مقيّم")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "مكتمل — 1 نقطة" })).toHaveLength(2);
  });
  it("sets 1 then renders the saved state", async () => {
    const user = userEvent.setup();
    render(<AssignmentReviewList assignmentId="a1" initialStudents={[students[0]]} />);
    await user.click(screen.getByRole("button", { name: "مكتمل — 1 نقطة" }));
    await waitFor(() => expect(screen.getByText("1 نقطة")).toBeTruthy());
    expect(fetch).toHaveBeenCalledWith("/api/admin/assignments/a1/reviews/st1", expect.objectContaining({ method: "PUT", body: JSON.stringify({ score: 1 }) }));
  });
  it("updates 1 to 0 and exposes the pressed state", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ success: true, grade: { score: 0, gradedAt: "2026-10-15T00:00:00.000Z" } }) } as Response);
    const user = userEvent.setup();
    render(<AssignmentReviewList assignmentId="a1" initialStudents={[students[1]]} />);
    await user.click(screen.getByRole("button", { name: "غير مكتمل — 0 نقطة" }));
    await waitFor(() => expect(screen.getByText("0 نقطة")).toBeTruthy());
    expect(screen.getByRole("button", { name: "غير مكتمل — 0 نقطة" }).getAttribute("aria-pressed")).toBe("true");
  });
  it("shows a safe error and re-enables controls", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, json: async () => ({ success: false, message: "تعذر حفظ التقييم." }) } as Response);
    const user = userEvent.setup();
    render(<AssignmentReviewList assignmentId="a1" initialStudents={[students[0]]} />);
    await user.click(screen.getByRole("button", { name: "مكتمل — 1 نقطة" }));
    expect((await screen.findByRole("alert")).textContent).toContain("تعذر حفظ التقييم.");
    await waitFor(() => expect((screen.getByRole("button", { name: "مكتمل — 1 نقطة" }) as HTMLButtonElement).disabled).toBe(false));
  });
});
