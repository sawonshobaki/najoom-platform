import type { LessonResourceType } from "@/generated/prisma/enums";
import type { OulaDialogueContext } from "@/components/oula/oula-content";

const presentations: Record<LessonResourceType, {
  label: string;
  action: string;
  context: OulaDialogueContext;
}> = {
  VIDEO: { label: "فيديو", action: "شاهدي الفيديو", context: "VIDEO" },
  GAME: { label: "لعبة", action: "ابدئي النشاط", context: "RESOURCE" },
  SIMULATION: { label: "محاكاة", action: "ابدئي المحاكاة", context: "RESOURCE" },
  ARTICLE: { label: "مادة إثرائية", action: "اقرئي المادة", context: "EXPLANATION" },
};

export function getLessonResourceLabel(type: LessonResourceType): string {
  return presentations[type].label;
}

export function getLessonResourcePresentation(type: LessonResourceType) {
  return presentations[type];
}

/** External navigation only; never interpret an arbitrary URL as executable markup. */
export function isSafeLessonResourceUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return /^https?:\/\//i.test(url) &&
      (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}
