import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ImageProps } from "next/image";
import type { SyntheticEvent } from "react";

const { imageMock } = vi.hoisted(() => ({ imageMock: vi.fn() }));
vi.mock("next/image", () => ({ default: (props: ImageProps) => {
  imageMock(props);
  // Render only the image's accessible markup; exercise its error handler below.
  // eslint-disable-next-line @next/next/no-img-element -- DOM stand-in for the mocked Next Image, used only in tests.
  return <img src={typeof props.src === "string" ? props.src : ""} alt={props.alt} width={props.width} height={props.height} />;
} }));

import { OulaGuide } from "./oula-guide";
import { OULA_ASSETS, OULA_MESSAGES, OULA_STATES, getOulaGuideMessage } from "./oula-content";

beforeEach(() => { imageMock.mockClear(); });

describe("Oula guide", () => {
  it.each(OULA_STATES)("renders %s with its default PNG asset and deterministic message", (state) => {
    const html = renderToStaticMarkup(<OulaGuide state={state} />);
    expect(html).toContain(OULA_MESSAGES[state][0]);
    expect(getOulaGuideMessage(state)).toBe(OULA_MESSAGES[state][0]);
    expect(OULA_MESSAGES[state]).toHaveLength(2);
    expect(OULA_ASSETS[state]).toBe(`/characters/oula/${state.toLowerCase()}.png`);
    expect(html).toContain(`data-state="${state}"`);
    expect(html).toContain('<aside dir="rtl" aria-label="عُلا —');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-atomic="true"');
    expect(imageMock.mock.calls[0][0]).toMatchObject({ src: OULA_ASSETS[state], alt: "عُلا، المساعدة التعليمية لمنصة نجوم" });
    expect(html).toContain(`src="${OULA_ASSETS[state]}"`);
  });
  it("uses a custom encouraging message", () => {
    const html = renderToStaticMarkup(<OulaGuide state="HINT" message="تقدري تجرّبي خطوة ثانية." />);
    expect(html).toContain("تقدري تجرّبي خطوة ثانية.");
    expect(html).not.toContain(OULA_MESSAGES.HINT[0]);
  });
  it("falls back to the default for an empty custom message", () => {
    expect(renderToStaticMarkup(<OulaGuide state="SUCCESS" message="  " />)).toContain(OULA_MESSAGES.SUCCESS[0]);
  });
  it("shows optional student, lesson and unit context as escaped text", () => {
    const html = renderToStaticMarkup(<OulaGuide state="WELCOME" studentName="سارة" lessonTitle="مفاهيم النظام البيئي" unitTitle="البيئة" />);
    expect(html).toContain("معكِ يا <bdi>سارة</bdi>");
    expect(html).toContain("مفاهيم النظام البيئي");
    expect(html).toContain("البيئة");
    expect(html).toContain("<dt>الدرس:</dt>");
    expect(html).toContain("<dt>الوحدة:</dt>");
    const escaped = renderToStaticMarkup(<OulaGuide state="HINT" message="<script>bad</script>" />);
    expect(escaped).not.toContain("<script>");
    expect(escaped).toContain("&lt;script&gt;");
  });
  it("allows opting out of images with a safe placeholder", () => {
    const html = renderToStaticMarkup(<OulaGuide state="LAB" imageSrc={null} />);
    expect(html).not.toContain("<img");
    expect(html).toContain('<span aria-hidden="true">ع</span>');
    expect(html).toContain("عُلا");
    expect(imageMock).not.toHaveBeenCalled();
  });
  it("provides descriptive image alt and hides a failed image to reveal the placeholder", () => {
    const html = renderToStaticMarkup(<OulaGuide state="RESOURCE" />);
    expect(html).toContain('alt="عُلا، المساعدة التعليمية لمنصة نجوم"');
    expect(html).toContain('<span aria-hidden="true">ع</span>');
    const props = imageMock.mock.calls[0][0] as ImageProps;
    const failedImage = { hidden: false };
    props.onError?.({ currentTarget: failedImage } as unknown as SyntheticEvent<HTMLImageElement>);
    expect(failedImage.hidden).toBe(true);
    expect(html).toContain(OULA_MESSAGES.RESOURCE[0]);
  });
  it("uses a manual image override and retains fallback if it fails", () => {
    const html = renderToStaticMarkup(<OulaGuide state="HINT" imageSrc="/custom/oula.png" />);
    const props = imageMock.mock.calls[0][0] as ImageProps;
    expect(props.src).toBe("/custom/oula.png");
    expect(html).toContain('src="/custom/oula.png"');
    expect(html).not.toContain(OULA_ASSETS.HINT);
    expect(html).toContain(OULA_MESSAGES.HINT[0]);
    const failedImage = { hidden: false };
    props.onError?.({ currentTarget: failedImage } as unknown as SyntheticEvent<HTMLImageElement>);
    expect(failedImage.hidden).toBe(true);
    expect(html).toContain('<span aria-hidden="true">ع</span>');
  });
  it("uses smaller dimensions in compact mode while keeping the message and lesson context", () => {
    const compact = renderToStaticMarkup(<OulaGuide state="WELCOME" lessonTitle="الخلية" compact imageSrc="/characters/oula/welcome.png" />);
    const normal = renderToStaticMarkup(<OulaGuide state="WELCOME" />);
    expect(compact).toContain("h-12 w-12");
    expect(normal).toContain("h-16 w-16");
    expect(compact).toContain("الخلية");
    expect(compact).toContain(OULA_MESSAGES.WELCOME[0]);
    expect(imageMock.mock.calls[0][0]).toMatchObject({ width: 48, height: 48 });
  });
});
