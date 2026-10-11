import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LessonResourceCard, type LessonResourceCardProps } from "./lesson-resource-card";
import { getLessonResourceLabel } from "./lesson-resource-presentation";
import { getOulaMessage } from "@/components/oula/oula-content";
import { ResourceExperiencePreview } from "@/app/admin/curriculum/resource-experience-preview";

const resource: LessonResourceCardProps = {
  title: "عنوان المورد", url: "https://example.org/activity", type: "VIDEO",
  language: "العربية", isFree: true, lessonTitle: "عنوان الدرس",
};

function render(overrides: Partial<LessonResourceCardProps> = {}) {
  return renderToStaticMarkup(<LessonResourceCard {...resource} {...overrides} />);
}

describe("lesson resource experience", () => {
  it.each([
    ["VIDEO", "فيديو", "شاهدي الفيديو", "VIDEO", "RESOURCE"],
    ["GAME", "لعبة", "ابدئي النشاط", "RESOURCE", "RESOURCE"],
    ["SIMULATION", "محاكاة", "ابدئي المحاكاة", "RESOURCE", "RESOURCE"],
    ["ARTICLE", "مادة إثرائية", "اقرئي المادة", "EXPLANATION", "THINKING"],
  ] as const)("presents %s with its Arabic label, action and Oula dialogue", (type, label, action, context, state) => {
    const html = render({ type });
    expect(getLessonResourceLabel(type)).toBe(label);
    expect(html).toContain(`<dd>${label}</dd>`);
    expect(html).toContain(action);
    expect(html).toContain(getOulaMessage(context));
    expect(html).toContain(`data-state="${state}"`);
  });
  it("uses Arabic instructions instead of the default dialogue", () => {
    const html = render({ instructionsArabic: "  راقبي المثال بعناية.  " });
    expect(html).toContain("راقبي المثال بعناية.");
    expect(html).not.toContain(getOulaMessage("VIDEO"));
  });
  it.each([undefined, null, "", "   "])("falls back for absent or blank instructions (%s)", (instructionsArabic) => {
    expect(render({ instructionsArabic })).toContain(getOulaMessage("VIDEO"));
  });
  it("provides semantic RTL markup, image alt, lesson context and a safe named link", () => {
    const html = render();
    expect(html).toContain('<article dir="rtl" aria-label="مورد تعليمي: عنوان المورد"');
    expect(html).toContain('href="https://example.org/activity" target="_blank" rel="noopener noreferrer"');
    expect(html).toContain('aria-label="شاهدي الفيديو: عنوان المورد — يفتح في تبويب جديد"');
    expect(html).toContain('alt="عُلا، المساعدة التعليمية لمنصة نجوم"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("عنوان الدرس");
    expect(html).toContain("مجاني");
    expect(html).not.toContain("<iframe");
  });
  it("displays the supplied language and nonfree status", () => {
    const html = render({ isFree: false, language: "English" });
    expect(html).toContain("غير مجاني");
    expect(html).toContain("<bdi>English</bdi>");
  });
  it("keeps the compact avatar small and the action responsive", () => {
    const html = render({ compact: true });
    expect(html).toContain('width="48"');
    expect(html).toContain('height="48"');
    expect(html).toContain("object-contain");
    expect(html).toContain("sm:w-auto");
    expect(html).toContain("space-y-3 p-3");
    expect(render()).toContain('width="64"');
  });
  it.each(["javascript:alert(1)", "data:text/html,test", "/activity", "https://user:secret@example.org", "not a url"])("does not navigate to an unsafe URL: %s", (url) => {
    const html = render({ url });
    expect(html).not.toContain("<a ");
    expect(html).toContain('disabled=""');
    expect(html).toContain("رابط المورد غير متاح حاليًا.");
  });
  it("allows an HTTP resource as supported by the resource service", () => {
    expect(render({ url: "http://example.org/activity" })).toContain('href="http://example.org/activity"');
  });
  it("escapes resource text and instructions", () => {
    const html = render({ title: "<script>title</script>", instructionsArabic: "<script>instruction</script>" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;instruction&lt;/script&gt;");
  });
  it("renders a clearly marked static preview without navigation when resources are absent", () => {
    const html = renderToStaticMarkup(<ResourceExperiencePreview />);
    expect(html).toContain("معاينة فقط");
    expect(html).toContain("لم تُضف موارد إلى المنهج بعد");
    expect(html).toContain('disabled=""');
    expect(html).not.toContain("<a ");
  });
  it("previews an actual curriculum resource and its instructions when supplied", () => {
    const html = renderToStaticMarkup(<ResourceExperiencePreview resource={{ ...resource, instructionsArabic: "تعليمات المورد الموجود" }} />);
    expect(html).toContain("معاينة مورد موجود في المنهج");
    expect(html).toContain("تعليمات المورد الموجود");
    expect(html).toContain(resource.url);
    expect(html).not.toContain("معاينة فقط");
  });
});
