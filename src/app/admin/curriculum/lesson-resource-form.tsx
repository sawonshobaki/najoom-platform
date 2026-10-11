"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { LessonResourceType } from "@/generated/prisma/enums";

type Resource = {
  id: string; title: string; url: string; type: LessonResourceType; language: string;
  isFree: boolean; instructionsArabic: string | null; sortOrder: number;
};
const typeLabels: Record<LessonResourceType, string> = { VIDEO: "فيديو", GAME: "لعبة", SIMULATION: "محاكاة", ARTICLE: "مقالة" };

export function LessonResourceForm({ lessonId, resource }: { lessonId: string; resource?: Resource }) {
  const router = useRouter();
  const formId = useId();
  const [title, setTitle] = useState(resource?.title ?? "");
  const [url, setUrl] = useState(resource?.url ?? "");
  const [type, setType] = useState<LessonResourceType>(resource?.type ?? "VIDEO");
  const [language, setLanguage] = useState(resource?.language ?? "");
  const [isFree, setIsFree] = useState(resource?.isFree ?? true);
  const [instructionsArabic, setInstructionsArabic] = useState(resource?.instructionsArabic ?? "");
  const [sortOrder, setSortOrder] = useState(resource ? String(resource.sortOrder) : "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const response = await fetch(`/api/admin/curriculum/resources${resource ? `/${encodeURIComponent(resource.id)}` : ""}`, {
        method: resource ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(!resource ? { lessonId } : {}), title, url, type, language, isFree, instructionsArabic, sortOrder: Number(sortOrder) }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || body === null || typeof body !== "object" || !("success" in body) || body.success !== true) {
        setErrorMessage(body !== null && typeof body === "object" && "message" in body && typeof body.message === "string"
          ? body.message : "تعذر حفظ مورد الدرس.");
        return;
      }
      if (!resource) {
        setTitle(""); setUrl(""); setType("VIDEO"); setLanguage(""); setIsFree(true); setInstructionsArabic(""); setSortOrder("");
      }
      setSuccessMessage(resource ? "تم تعديل مورد الدرس." : "تمت إضافة مورد الدرس.");
      router.refresh();
    } catch {
      setErrorMessage("تعذر الاتصال بالمنصة الآن. حاولي مرة أخرى.");
    } finally { setIsSubmitting(false); }
  }

  const inputClass = "mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[var(--najoom-gold)]";
  return (
    <form onSubmit={handleSubmit} noValidate className="mt-3 space-y-3">
      <div>
        <label htmlFor={`${formId}-title`} className="font-medium text-slate-700">عنوان المورد</label>
        <input id={`${formId}-title`} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={150} required className={inputClass} />
      </div>
      <div>
        <label htmlFor={`${formId}-url`} className="font-medium text-slate-700">رابط المصدر</label>
        <input id={`${formId}-url`} type="url" dir="ltr" value={url} onChange={(event) => setUrl(event.target.value)} maxLength={2048} required className={inputClass} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor={`${formId}-type`} className="font-medium text-slate-700">نوع المورد</label>
          <select id={`${formId}-type`} value={type} onChange={(event) => setType(event.target.value as LessonResourceType)} className={inputClass}>
            {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`${formId}-language`} className="font-medium text-slate-700">لغة المورد</label>
          <input id={`${formId}-language`} value={language} onChange={(event) => setLanguage(event.target.value)} maxLength={50} required className={inputClass} />
        </div>
        <div>
          <label htmlFor={`${formId}-order`} className="font-medium text-slate-700">ترتيب المورد</label>
          <input id={`${formId}-order`} type="number" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} min={1} max={2147483647} step={1} required className={inputClass} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input id={`${formId}-free`} type="checkbox" checked={isFree} onChange={(event) => setIsFree(event.target.checked)} />
        <label htmlFor={`${formId}-free`}>المورد مجاني</label>
      </div>
      <div>
        <label htmlFor={`${formId}-instructions`} className="font-medium text-slate-700">التعليمات العربية (اختياري)</label>
        <textarea id={`${formId}-instructions`} value={instructionsArabic} onChange={(event) => setInstructionsArabic(event.target.value)} maxLength={5000} rows={3} className={inputClass} />
      </div>
      <button type="submit" disabled={isSubmitting} className="rounded-xl bg-[var(--najoom-navy)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
        {isSubmitting ? "جارٍ الحفظ..." : resource ? "حفظ التعديل" : "إضافة مورد"}
      </button>
      {errorMessage ? <p role="alert" className="text-red-600">{errorMessage}</p> : null}
      {successMessage ? <p role="status" className="text-emerald-700">{successMessage}</p> : null}
    </form>
  );
}
