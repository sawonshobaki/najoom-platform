import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("./student-assessment-attempt", () => ({ StudentAssessmentAttempt: ({ assessmentId }: { assessmentId: string }) => <div data-assessment={assessmentId}>محاولة الطالبة</div> }));
import Page from "./page";
describe("student assessment page", () => {
  it("renders in RTL with a return link and the route assessment ID", async () => { const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ assessmentId: "a1" }) })); expect(html).toContain('dir="rtl"'); expect(html).toContain('href="/student"'); expect(html).toContain('data-assessment="a1"'); });
});
