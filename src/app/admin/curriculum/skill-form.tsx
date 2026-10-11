"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type SkillFormProps = {
  skill?: { id: string; name: string; description: string | null };
};

export function SkillForm({ skill }: SkillFormProps) {
  const router = useRouter();
  const formId = useId();
  const label = "المهارة";
  const [name, setName] = useState(skill?.name ?? "");
  const [description, setDescription] = useState(skill?.description ?? "");
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
      const response = await fetch(`/api/admin/curriculum/skills${skill ? `/${skill.id}` : ""}`, {
        method: skill ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || body === null || typeof body !== "object" || !("success" in body) || body.success !== true) {
        setErrorMessage(body !== null && typeof body === "object" && "message" in body && typeof body.message === "string"
          ? body.message : `تعذر حفظ ${label}.`);
        return;
      }
      if (!skill) { setName(""); setDescription(""); }
      setSuccessMessage(skill ? `تم تعديل ${label}.` : `تمت إضافة ${label}.`);
      router.refresh();
    } catch {
      setErrorMessage("تعذر الاتصال بالمنصة الآن. حاولي مرة أخرى.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass = "mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[var(--najoom-gold)]";
  return (
    <form onSubmit={handleSubmit} noValidate className="mt-3 space-y-3">
      <div>
        <label htmlFor={`${formId}-name`} className="text-sm font-medium text-slate-700">اسم {label}</label>
        <input id={`${formId}-name`} value={name} onChange={(event) => setName(event.target.value)} maxLength={150} required className={inputClass} />
      </div>
      <div>
        <label htmlFor={`${formId}-description`} className="text-sm font-medium text-slate-700">الوصف (اختياري)</label>
        <textarea id={`${formId}-description`} value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={5000} className={inputClass} />
      </div>
      <button type="submit" disabled={isSubmitting} className="rounded-xl bg-[var(--najoom-navy)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
        {isSubmitting ? "جارٍ الحفظ..." : skill ? "حفظ التعديل" : `إضافة ${label}`}
      </button>
      {errorMessage ? <p role="alert" className="text-sm leading-6 text-red-600">{errorMessage}</p> : null}
      {successMessage ? <p role="status" className="text-sm text-emerald-700">{successMessage}</p> : null}
    </form>
  );
}
