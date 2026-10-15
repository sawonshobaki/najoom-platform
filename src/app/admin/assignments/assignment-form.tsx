"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import type { AssignmentCreationData } from "@/lib/assignments/assignment-service";

type FormValues = { title: string; description: string; gradeId: string; semesterId: string; unitId: string; lessonId: string; weekNumber: number; externalUrl: string };

export function AssignmentForm({ curriculum }: { curriculum: AssignmentCreationData }) {
  const router = useRouter();
  const { register, handleSubmit, control, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({ defaultValues: { title: "", description: "", gradeId: "", semesterId: "", unitId: "", lessonId: "", weekNumber: 1, externalUrl: "" } });
  const [serverError, setServerError] = useState("");
  const [gradeId, semesterId, unitId] = useWatch({ control, name: ["gradeId", "semesterId", "unitId"] });
  const semesters = curriculum.find(grade => grade.id === gradeId)?.semesters ?? [];
  const units = semesters.find(semester => semester.id === semesterId)?.units ?? [];
  const lessons = units.find(unit => unit.id === unitId)?.lessons ?? [];
  const inputClass = "mt-1 min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white p-3 focus:ring-2 focus:ring-[var(--najoom-gold)]";
  function clearAfter(field: "grade" | "semester" | "unit") {
    if (field === "grade") setValue("semesterId", "");
    if (field !== "unit") setValue("unitId", "");
    setValue("lessonId", "");
  }
  async function submit(values: FormValues) {
    setServerError("");
    try {
      const response = await fetch("/api/admin/assignments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lessonId: values.lessonId, title: values.title.trim(), description: values.description.trim() || null, externalUrl: values.externalUrl.trim(), weekNumber: Number(values.weekNumber) }) });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || !body || typeof body !== "object" || !("success" in body) || body.success !== true) { setServerError(body && typeof body === "object" && "message" in body && typeof body.message === "string" ? body.message : "تعذر حفظ الواجب."); return; }
      router.push("/admin/assignments"); router.refresh();
    } catch { setServerError("تعذر الاتصال بالمنصة. حاولي مرة أخرى."); }
  }
  return <form dir="rtl" aria-label="إنشاء واجب خارجي" aria-busy={isSubmitting} onSubmit={handleSubmit(submit)} className="min-w-0 space-y-5 rounded-2xl bg-white p-4 shadow-sm sm:p-6">
    <fieldset disabled={isSubmitting} className="min-w-0 space-y-5"><legend className="sr-only">بيانات الواجب</legend>
      <div><label htmlFor="assignment-title">عنوان الواجب</label><input id="assignment-title" maxLength={200} className={inputClass} {...register("title", { required: "عنوان الواجب مطلوب.", validate: value => Boolean(value.trim()) || "عنوان الواجب مطلوب." })} />{errors.title ? <p role="alert" className="mt-2 text-sm text-red-700">{errors.title.message}</p> : null}</div>
      <div><label htmlFor="assignment-description">تعليمات الواجب <span className="text-sm text-slate-500">(اختياري)</span></label><textarea id="assignment-description" maxLength={2000} rows={4} placeholder="اكتبي المطلوب من الطالبات في هذا الواجب..." className={inputClass} {...register("description")} /></div>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <div><label htmlFor="assignment-grade">الصف</label><select id="assignment-grade" className={inputClass} {...register("gradeId", { required: true, onChange: () => clearAfter("grade") })}><option value="">اختاري الصف</option>{curriculum.map(grade => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></div>
        <div><label htmlFor="assignment-semester">الفصل الدراسي</label><select id="assignment-semester" disabled={!gradeId} className={inputClass} {...register("semesterId", { required: true, onChange: () => clearAfter("semester") })}><option value="">اختاري الفصل</option>{semesters.map(semester => <option key={semester.id} value={semester.id}>{semester.name} (⁦{semester.academicYear}⁩)</option>)}</select></div>
        <div><label htmlFor="assignment-unit">الوحدة</label><select id="assignment-unit" disabled={!semesterId} className={inputClass} {...register("unitId", { required: true, onChange: () => clearAfter("unit") })}><option value="">اختاري الوحدة</option>{units.map(unit => <option key={unit.id} value={unit.id}>{unit.title}</option>)}</select></div>
        <div><label htmlFor="assignment-lesson">الدرس</label><select id="assignment-lesson" disabled={!unitId} className={inputClass} {...register("lessonId", { required: true })}><option value="">اختاري الدرس</option>{lessons.map(lesson => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}</select></div>
        <div><label htmlFor="assignment-week">رقم الأسبوع</label><input id="assignment-week" type="number" min={1} step={1} className={inputClass} {...register("weekNumber", { valueAsNumber: true, required: "رقم الأسبوع مطلوب.", min: { value: 1, message: "رقم الأسبوع يجب أن يكون موجبًا." } })} />{errors.weekNumber ? <p role="alert" className="mt-2 text-sm text-red-700">{errors.weekNumber.message}</p> : null}</div>
        <div><label htmlFor="assignment-url">رابط الواجب</label><input id="assignment-url" type="url" inputMode="url" placeholder="https://example.com/assignment" className={inputClass} {...register("externalUrl", { required: "رابط الواجب مطلوب.", validate: value => value.trim().startsWith("https://") || "يجب استخدام رابط HTTPS آمن." })} />{errors.externalUrl ? <p role="alert" className="mt-2 text-sm text-red-700">{errors.externalUrl.message}</p> : null}</div>
      </div>
      <button type="submit" className="min-h-11 rounded-xl bg-[var(--najoom-navy)] px-5 py-3 font-semibold text-white disabled:opacity-50" disabled={isSubmitting}>{isSubmitting ? "جارٍ الحفظ…" : "حفظ الواجب"}</button>
    </fieldset>{serverError ? <p role="alert" className="text-red-700">{serverError}</p> : null}
  </form>;
}
