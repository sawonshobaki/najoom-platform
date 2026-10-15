// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
import { AssessmentStatusAction } from "./assessment-status-action";

beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal("confirm", vi.fn(() => true)); vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } }))); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("AssessmentStatusAction", () => {
  it("confirms and publishes with the narrow status contract", async () => {
    render(<AssessmentStatusAction assessmentId="a 1" target="PUBLISHED" />); fireEvent.click(screen.getByRole("button", { name: "نشر الاختبار" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    expect(confirm).toHaveBeenCalledWith("هل تريدين نشر الاختبار وإتاحته للطالبات؟");
    expect(fetch).toHaveBeenCalledWith("/api/admin/assessments/a%201/status", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "PUBLISHED" }) }));
  });
  it("does not close when confirmation is cancelled", () => {
    vi.mocked(confirm).mockReturnValue(false); render(<AssessmentStatusAction assessmentId="a1" target="CLOSED" />);
    fireEvent.click(screen.getByRole("button", { name: "إغلاق الاختبار" })); expect(fetch).not.toHaveBeenCalled();
  });
  it("shows a safe server error accessibly", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ success: false, message: "انتقال غير صالح" }), { status: 409, headers: { "Content-Type": "application/json" } }));
    render(<AssessmentStatusAction assessmentId="a1" target="PUBLISHED" />); fireEvent.click(screen.getByRole("button"));
    expect((await screen.findByRole("alert")).textContent).toContain("انتقال غير صالح"); expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
