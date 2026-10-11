"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type LessonFormProps = {
  unitId: string;
  lesson?: { id: string; title: string; description: string | null; sortOrder: number };
};

export function LessonForm({ unitId, lesson }: LessonFormProps) {
  const router = useRouter();
  const formId = useId();
  const [title, setTitle] = useState(lesson?.title ?? "");
  const [description, setDescription] = useState(lesson?.description ?? "");
  const [sortOrder, setSortOrder] = useState(lesson ? String(lesson.sortOrder) : "");
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
      const response = await fetch(lesson ? `/api/admin/curriculum/lessons/${lesson.id}` : "/api/admin/curriculum/lessons", {
        method: lesson ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(!lesson ? { unitId } : {}),
          title, description, sortOrder: Number(sortOrder),
        }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || body === null || typeof body !== "object" || !("success" in body) || body.success !== true) {
        setErrorMessage(
          body !== null && typeof body === "object" && "message" in body && typeof body.message === "string"
            ? body.message : "تعذر حفظ الدرس.",
        );
        return;
      }
      if (!lesson) {
        setTitle("");
        setDescription("");
        setSortOrder("");
      }
      setSuccessMessage(lesson ? "تم تعديل الدرس." : "تمت إضافة الدرس.");
      router.refresh();
    } catch {
      setErrorMessage("تعذر الاتصال بالمنصة الآن. حاولي مرة أخرى.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass = "mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[var(--najoom-gold)]";

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${formId}-title`} className="text-sm font-medium text-slate-700">عنوان الدرس</label>
          <input id={`${formId}-title`} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={150} required className={inputClass} />
        </div>
        <div>
          <label htmlFor={`${formId}-order`} className="text-sm font-medium text-slate-700">ترتيب الدرس</label>
          <input id={`${formId}-order`} type="number" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} min={1} max={2147483647} step={1} required className={inputClass} />
        </div>
      </div>
      <div>
        <label htmlFor={`${formId}-description`} className="text-sm font-medium text-slate-700">الوصف (اختياري)</label>
        <textarea id={`${formId}-description`} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={5000} rows={3} className={inputClass} />
      </div>
      <button type="submit" disabled={isSubmitting} className="rounded-xl bg-[var(--najoom-navy)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
        {isSubmitting ? "جارٍ الحفظ..." : lesson ? "حفظ التعديل" : "إضافة الدرس"}
      </button>
      {errorMessage ? <p role="alert" className="text-sm leading-6 text-red-600">{errorMessage}</p> : null}
      {successMessage ? <p role="status" className="text-sm text-emerald-700">{successMessage}</p> : null}
    </form>
  );
}
