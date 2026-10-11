import type { LessonResourceType } from "@/generated/prisma/enums";
import { OulaGuide } from "@/components/oula/oula-guide";
import { getOulaMessage, getOulaState } from "@/components/oula/oula-content";
import { getLessonResourcePresentation, isSafeLessonResourceUrl } from "./lesson-resource-presentation";

export type LessonResourceCardProps = {
  title: string;
  url: string;
  type: LessonResourceType;
  language: string;
  isFree: boolean;
  instructionsArabic?: string | null;
  lessonTitle?: string;
  compact?: boolean;
  /** Static admin previews never navigate to an invented resource. */
  preview?: boolean;
};

export function LessonResourceCard({
  title, url, type, language, isFree, instructionsArabic, lessonTitle,
  compact = false, preview = false,
}: LessonResourceCardProps) {
  const { label, action, context } = getLessonResourcePresentation(type);
  const canOpen = !preview && isSafeLessonResourceUrl(url);
  const actionClasses = "inline-flex w-full items-center justify-center rounded-xl bg-[var(--najoom-navy)] px-4 py-3 text-sm font-semibold text-white sm:w-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--najoom-blue)]";

  return (
    <article dir="rtl" aria-label={`مورد تعليمي: ${title}`}
      className={`min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] ${compact ? "space-y-3 p-3" : "space-y-4 p-4 sm:p-5"}`}>
      <header>
        {preview ? <p className="mb-2 text-xs font-semibold text-[var(--najoom-gold)]">معاينة فقط</p> : null}
        <h3 className="break-words text-base font-bold text-[var(--najoom-navy)]">{title}</h3>
        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--muted-foreground)]">
          <div className="flex gap-1"><dt>النوع:</dt><dd>{label}</dd></div>
          <div className="flex min-w-0 gap-1"><dt>اللغة:</dt><dd className="break-words"><bdi>{language}</bdi></dd></div>
          <div className="flex gap-1"><dt>التكلفة:</dt><dd>{isFree ? "مجاني" : "غير مجاني"}</dd></div>
        </dl>
      </header>
      <OulaGuide state={getOulaState(context)}
        message={instructionsArabic?.trim() || getOulaMessage(context)} lessonTitle={lessonTitle} compact={compact} />
      <div>
        {canOpen ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className={actionClasses}
            aria-label={`${action}: ${title} — يفتح في تبويب جديد`}>
            {action}<span className="sr-only"> — يفتح في تبويب جديد</span>
          </a>
        ) : (
          <button type="button" disabled className={`${actionClasses} cursor-not-allowed opacity-60`}>{action}</button>
        )}
        <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">
          {preview ? "مثال للعرض فقط؛ لا يوجد رابط نشاط فعلي." : canOpen ? "يفتح المورد الخارجي في تبويب جديد." : "رابط المورد غير متاح حاليًا."}
        </p>
      </div>
    </article>
  );
}
