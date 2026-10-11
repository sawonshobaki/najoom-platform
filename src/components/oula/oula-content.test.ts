import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { OULA_CONTEXT_STATES, OULA_DIALOGUE_CONTEXTS, OULA_DIALOGUES, OULA_STATES, getOulaMessage, getOulaState } from "./oula-content";
import { OulaGuide } from "./oula-guide";

describe("Oula dialogue library", () => {
  it("contains exactly the 16 requested contexts and 65 supplied phrases", () => {
    expect(OULA_DIALOGUE_CONTEXTS).toHaveLength(16);
    expect(Object.keys(OULA_DIALOGUES).sort()).toEqual([...OULA_DIALOGUE_CONTEXTS].sort());
    expect(Object.keys(OULA_CONTEXT_STATES).sort()).toEqual([...OULA_DIALOGUE_CONTEXTS].sort());
    expect(Object.values(OULA_DIALOGUES).reduce((count, messages) => count + messages.length, 0)).toBe(65);
    for (const [context, messages] of Object.entries(OULA_DIALOGUES)) {
      expect(messages).toHaveLength(context === "ENCOURAGEMENT" ? 5 : 4);
      expect(messages.every((message) => message.trim().length > 0 && !/غلط|فشل|سيئة/.test(message))).toBe(true);
    }
  });

  it.each(OULA_DIALOGUE_CONTEXTS)("selects deterministic messages and a known visual state for %s", (context) => {
    const messages = OULA_DIALOGUES[context];
    expect(getOulaMessage(context)).toBe(messages[0]);
    expect(getOulaMessage(context)).toBe(getOulaMessage(context));
    for (const [index, message] of messages.entries()) expect(getOulaMessage(context, index)).toBe(message);
    expect(getOulaMessage(context, messages.length)).toBe(messages[0]);
    expect(OULA_STATES).toContain(getOulaState(context));
  });

  it.each([-1, 1.5, NaN, Infinity, -Infinity, 99])("falls back to the first phrase for invalid index %s", (index) => {
    expect(getOulaMessage("RETRY", index)).toBe("قريبة يا نشمية، جرّبي مرة ثانية.");
  });

  it("preserves the exact supplied text, punctuation and emoji", () => {
    expect(getOulaMessage("WELCOME")).toBe("أهلين يا نشمية! جاهزة نبدأ؟ 🌟");
    expect(getOulaMessage("HINT", 1)).toBe("فكري شوي… شو المعلومة اللي ممكن تساعدك؟");
    expect(getOulaMessage("ENCOURAGEMENT", 4)).toBe("واضح إنك مركزة 👏");
  });

  it("maps educational situations to the requested visual states", () => {
    expect(OULA_CONTEXT_STATES).toEqual({
      WELCOME: "WELCOME", LESSON_START: "WELCOME", EXPLANATION: "THINKING", HINT: "HINT",
      RETRY: "THINKING", THINKING: "THINKING", CORRECT: "SUCCESS", ENCOURAGEMENT: "SUCCESS",
      LAB_START: "LAB", LAB_OBSERVATION: "LAB", RESOURCE: "RESOURCE", VIDEO: "RESOURCE",
      ACTIVITY_COMPLETE: "SUCCESS", LESSON_COMPLETE: "SUCCESS", REVIEW: "THINKING", MAJOR_ACHIEVEMENT: "SUCCESS",
    });
  });

  it("integrates a dialogue with the existing guide props without adding a new component API", () => {
    const html = renderToStaticMarkup(createElement(OulaGuide, {
      state: getOulaState("RETRY"), message: getOulaMessage("RETRY", 1), compact: true, imageSrc: null,
    }));
    expect(html).toContain('data-state="THINKING"');
    expect(html).toContain("محاولة حلوة! خلينا نفكر فيها من زاوية ثانية.");
    expect(html).toContain('aria-live="polite"');
  });
});
