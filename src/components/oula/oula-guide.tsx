"use client";

import Image from "next/image";
import { getOulaGuideMessage, OULA_ASSETS, OULA_STUDENT_GREETING, OULA_STATE_LABELS, type OulaState } from "./oula-content";

export type OulaGuideProps = {
  state: OulaState;
  message?: string;
  studentName?: string;
  lessonTitle?: string;
  unitTitle?: string;
  compact?: boolean;
  /** عدم تمريره يستخدم صورة الحالة؛ null يعرض placeholder، والنص يحدد صورة بديلة. */
  imageSrc?: string | null;
};

const variants: Record<OulaState, { icon: string; border: string }> = {
  WELCOME: { icon: "👋", border: "border-[var(--najoom-navy)]" },
  HINT: { icon: "💡", border: "border-[var(--najoom-gold)]" },
  THINKING: { icon: "🤔", border: "border-[var(--najoom-blue)]" },
  SUCCESS: { icon: "🌟", border: "border-[var(--success)]" },
  LAB: { icon: "🔬", border: "border-[var(--najoom-teal)]" },
  RESOURCE: { icon: "🎮", border: "border-[var(--najoom-sky)]" },
};

export function OulaGuide({ state, message, studentName, lessonTitle, unitTitle, compact = false, imageSrc }: OulaGuideProps) {
  const variant = variants[state];
  const label = OULA_STATE_LABELS[state];
  const avatarSize = compact ? 48 : 64;
  const resolvedImageSrc = imageSrc === undefined ? OULA_ASSETS[state] : imageSrc;
  return (
    <aside dir="rtl" aria-label={`عُلا — ${label}`} data-state={state}
      className={`flex w-full max-w-xl items-start gap-3 rounded-2xl border bg-[var(--surface-soft)] ${variant.border} ${compact ? "p-3" : "p-4"}`}>
      <div className="shrink-0 text-center">
        <div className={`relative flex items-center justify-center overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xl font-bold text-[var(--najoom-navy)] ${compact ? "h-12 w-12" : "h-16 w-16"}`}>
          <span aria-hidden="true">ع</span>
          {resolvedImageSrc ? (
            <Image key={resolvedImageSrc} src={resolvedImageSrc} alt="عُلا، المساعدة التعليمية لمنصة نجوم"
              width={avatarSize} height={avatarSize} unoptimized
              className="absolute inset-0 h-full w-full bg-[var(--surface)] object-contain"
              onError={(event) => { event.currentTarget.hidden = true; }} />
          ) : null}
        </div>
        <p className="mt-1 text-sm font-semibold text-[var(--najoom-navy)]">عُلا</p>
      </div>
      <div className={`min-w-0 flex-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)] ${compact ? "p-2.5" : "p-3"}`}>
        <p className="text-xs font-semibold text-[var(--najoom-navy)]">
          <span aria-hidden="true" className="me-1">{variant.icon}</span>{label}
        </p>
        {studentName?.trim() ? <p className="mt-1 break-words text-xs text-[var(--muted-foreground)]">{OULA_STUDENT_GREETING}<bdi>{studentName}</bdi></p> : null}
        <p aria-live="polite" aria-atomic="true" className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--foreground)]">
          {getOulaGuideMessage(state, message)}
        </p>
        {unitTitle?.trim() || lessonTitle?.trim() ? (
          <dl className="mt-2 space-y-1 text-xs leading-5 text-[var(--muted-foreground)]">
            {unitTitle?.trim() ? <div className="flex flex-wrap gap-x-1"><dt>الوحدة:</dt><dd className="min-w-0 break-words">{unitTitle}</dd></div> : null}
            {lessonTitle?.trim() ? <div className="flex flex-wrap gap-x-1"><dt>الدرس:</dt><dd className="min-w-0 break-words">{lessonTitle}</dd></div> : null}
          </dl>
        ) : null}
      </div>
    </aside>
  );
}
