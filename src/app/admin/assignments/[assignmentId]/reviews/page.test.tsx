import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/lib/assignments/assignment-review-service", () => ({ listAssignmentReviews: mocks.list }));
import AssignmentReviewsPage from "./page";

describe("AssignmentReviewsPage", () => {
  it("renders an RTL assignment summary and the active student list", async () => {
    mocks.list.mockResolvedValue({
      assignment: { id: "a1", title: "واجب الخلية", description: "قارني بين الخليتين", externalUrl: "https://example.edu/task", weekNumber: 3, lessonTitle: "الخلية" },
      students: [{ id: "st1", fullName: "سارة أحمد", sectionName: "أ", score: null, gradedAt: null }],
    });
    const html = renderToStaticMarkup(await AssignmentReviewsPage({ params: Promise.resolve({ assignmentId: "a1" }) }));
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("مراجعة: واجب الخلية");
    expect(html).toContain("الأسبوع 3");
    expect(html).toContain("سارة أحمد");
    expect(html).toContain("غير مقيّم");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});
