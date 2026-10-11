"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type SemesterFormProps = {
  gradeId: string;
  semester?: { id: string; name: string; academicYear: string; sortOrder: number };
};

export function SemesterForm({ gradeId, semester }: SemesterFormProps) {
  const router = useRouter();
  const formId = useId();
  const [name, setName] = useState(semester?.name ?? "");
  const [academicYear, setAcademicYear] = useState(semester?.academicYear ?? "");
  const [sortOrder, setSortOrder] = useState(semester ? String(semester.sortOrder) : "");
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
      const response = await fetch(
        semester ? `/api/admin/curriculum/semesters/${semester.id}` : "/api/admin/curriculum/semesters",
        {
          method: semester ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(!semester ? { gradeId } : {}),
            name,
            academicYear,
            sortOrder: Number(sortOrder),
          }),
        },
      );
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || body === null || typeof body !== "object" || !("success" in body) || body.success !== true) {
        setErrorMessage(
          body !== null && typeof body === "object" && "message" in body && typeof body.message === "string"
            ? body.message : "تعذر حفظ الفصل الدراسي.",
        );
        return;
      }
      if (!semester) {
        setName("");
        setAcademicYear("");
        setSortOrder("");
      }
      setSuccessMessage(semester ? "تم تعديل الفصل الدراسي." : "تمت إضافة الفصل الدراسي.");
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
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor={`${formId}-name`} className="text-sm font-medium text-slate-700">اسم الفصل الدراسي</label>
          <input id={`${formId}-name`} value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required className={inputClass} />
        </div>
        <div>
          <label htmlFor={`${formId}-year`} className="text-sm font-medium text-slate-700">السنة الدراسية</label>
          <input id={`${formId}-year`} value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} placeholder="2026-2027" dir="ltr" maxLength={9} required aria-describedby={`${formId}-year-hint`} className={inputClass} />
          <p id={`${formId}-year-hint`} className="mt-1 text-xs text-slate-500">سنتان متتاليتان بصيغة YYYY-YYYY.</p>
        </div>
        <div>
          <label htmlFor={`${formId}-order`} className="text-sm font-medium text-slate-700">ترتيب الفصل</label>
          <input id={`${formId}-order`} type="number" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} min={1} max={2147483647} step={1} required className={inputClass} />
        </div>
      </div>
      <button type="submit" disabled={isSubmitting} className="rounded-xl bg-[var(--najoom-navy)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
        {isSubmitting ? "جارٍ الحفظ..." : semester ? "حفظ التعديل" : "إضافة الفصل الدراسي"}
      </button>
      {errorMessage ? <p role="alert" className="text-sm leading-6 text-red-600">{errorMessage}</p> : null}
      {successMessage ? <p role="status" className="text-sm text-emerald-700">{successMessage}</p> : null}
    </form>
  );
}
