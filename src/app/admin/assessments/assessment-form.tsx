"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import type { AssessmentCreationData } from "@/lib/assessments/assessment-service";

type FormValues = { title: string; gradeId: string; semesterId: string; unitId: string; lessonId: string };
const difficultyLabels = { EASY: "سهل", MEDIUM: "متوسط", HARD: "صعب" } as const;

export function reorderQuestionIds(ids: string[], id: string, direction: -1 | 1) {
  const index = ids.indexOf(id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ids.length) return ids;
  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function AssessmentForm({ curriculum, questions }: AssessmentCreationData) {
  const router = useRouter();
  const { register, handleSubmit, control, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    defaultValues: { title: "", gradeId: "", semesterId: "", unitId: "", lessonId: "" },
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [serverError, setServerError] = useState("");
  const [gradeId, semesterId, unitId, lessonId] = useWatch({ control, name: ["gradeId", "semesterId", "unitId", "lessonId"] });
  const semesters = curriculum.find(grade => grade.id === gradeId)?.semesters ?? [];
  const units = semesters.find(semester => semester.id === semesterId)?.units ?? [];
  const lessons = units.find(unit => unit.id === unitId)?.lessons ?? [];
  const availableQuestions = useMemo(() => questions.filter(question => question.lessonId === lessonId), [questions, lessonId]);
  const selectedQuestions = selectedIds.map(id => questions.find(question => question.id === id)).filter((question): question is NonNullable<typeof question> => Boolean(question));
  const totalPoints = selectedQuestions.reduce((sum, question) => sum + question.points, 0);
  const inputClass = "mt-1 min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white p-3 focus:ring-2 focus:ring-[var(--najoom-gold)]";
  const buttonClass = "min-h-10 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-40 focus:ring-2 focus:ring-[var(--najoom-gold)]";

  function clearAfter(field: "grade" | "semester" | "unit") {
    if (field === "grade") setValue("semesterId", "");
    if (field !== "unit") setValue("unitId", "");
    setValue("lessonId", "");
    setSelectedIds([]);
  }

  function toggleQuestion(id: string) {
    setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : current.length < 50 ? [...current, id] : current);
  }

  async function submit(values: FormValues) {
    if (selectedIds.length === 0) return;
    setServerError("");
    try {
      const response = await fetch("/api/admin/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: values.title.trim(), lessonId: values.lessonId, questionIds: selectedIds }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || !body || typeof body !== "object" || !("success" in body) || body.success !== true) {
        setServerError(body && typeof body === "object" && "message" in body && typeof body.message === "string" ? body.message : "تعذر حفظ الاختبار. حاولي مرة أخرى.");
        return;
      }
      router.push("/admin/assessments");
      router.refresh();
    } catch {
      setServerError("تعذر الاتصال بالمنصة. حاولي مرة أخرى.");
    }
  }

  return <form dir="rtl" aria-label="إنشاء اختبار" aria-busy={isSubmitting} onSubmit={handleSubmit(submit)} className="min-w-0 space-y-6 rounded-2xl bg-white p-4 shadow-sm sm:p-6">
    <fieldset disabled={isSubmitting} className="min-w-0 space-y-6">
      <legend className="sr-only">بيانات الاختبار</legend>
      <div><label htmlFor="assessment-title">عنوان الاختبار</label><input id="assessment-title" className={inputClass} maxLength={200} {...register("title", { required: "عنوان الاختبار مطلوب.", validate: value => Boolean(value.trim()) || "عنوان الاختبار مطلوب." })} />
        {errors.title ? <p role="alert" className="mt-2 text-sm text-red-700">{errors.title.message}</p> : null}</div>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <div className="min-w-0"><label htmlFor="assessment-grade">الصف</label><select id="assessment-grade" className={inputClass} {...register("gradeId", { required: true, onChange: () => clearAfter("grade") })}><option value="">اختاري الصف</option>{curriculum.map(grade => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></div>
        <div className="min-w-0"><label htmlFor="assessment-semester">الفصل الدراسي</label><select id="assessment-semester" disabled={!gradeId} className={inputClass} {...register("semesterId", { required: true, onChange: () => clearAfter("semester") })}><option value="">اختاري الفصل الدراسي</option>{semesters.map(semester => <option key={semester.id} value={semester.id}>{`${semester.name} (\u2066${semester.academicYear}\u2069)`}</option>)}</select></div>
        <div className="min-w-0"><label htmlFor="assessment-unit">الوحدة</label><select id="assessment-unit" disabled={!semesterId} className={inputClass} {...register("unitId", { required: true, onChange: () => clearAfter("unit") })}><option value="">اختاري الوحدة</option>{units.map(unit => <option key={unit.id} value={unit.id}>{unit.title}</option>)}</select></div>
        <div className="min-w-0"><label htmlFor="assessment-lesson">الدرس</label><select id="assessment-lesson" disabled={!unitId} className={inputClass} {...register("lessonId", { required: true, onChange: () => setSelectedIds([]) })}><option value="">اختاري الدرس</option>{lessons.map(lesson => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}</select></div>
      </div>

      <section aria-labelledby="available-questions" className="min-w-0 space-y-3">
        <h2 id="available-questions" className="text-lg font-semibold">أسئلة الدرس</h2>
        {!lessonId ? <p className="text-sm text-slate-600">اختاري درسًا لعرض أسئلته.</p> : availableQuestions.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-slate-600">لا توجد أسئلة متاحة لهذا الدرس حتى الآن.</p> :
          <ul className="space-y-3">
            {availableQuestions.map(question => <li key={question.id} className="min-w-0 rounded-xl border border-slate-200 p-3">
              <label className="flex min-w-0 items-start gap-3"><input type="checkbox" className="mt-1 size-5 shrink-0" checked={selectedIds.includes(question.id)} onChange={() => toggleQuestion(question.id)} />
                <span className="min-w-0"><span className="block whitespace-pre-wrap break-words font-medium">{question.text}</span><span className="mt-1 block text-sm text-slate-600">{question.type === "TRUE_FALSE" ? "صح أو خطأ" : "اختيار من متعدد"} · {difficultyLabels[question.difficulty]} · {question.points} نقطة</span></span></label>
            </li>)}
          </ul>}
      </section>

      <section aria-labelledby="selected-questions" className="min-w-0 space-y-3">
        <h2 id="selected-questions" className="text-lg font-semibold">الأسئلة المختارة وترتيبها</h2>
        <p role="status">عدد الأسئلة: {selectedQuestions.length} · مجموع النقاط: {totalPoints}</p>
        {selectedQuestions.length ? <ol className="space-y-3">
          {selectedQuestions.map((question, index) => <li key={question.id} className="min-w-0 rounded-xl bg-slate-50 p-3">
            <p className="break-words"><span className="font-semibold">{index + 1}.</span> {question.text}</p>
            <div className="mt-3 flex flex-wrap gap-2"><button type="button" className={buttonClass} disabled={index === 0} onClick={() => setSelectedIds(ids => reorderQuestionIds(ids, question.id, -1))}>تحريك لأعلى</button><button type="button" className={buttonClass} disabled={index === selectedQuestions.length - 1} onClick={() => setSelectedIds(ids => reorderQuestionIds(ids, question.id, 1))}>تحريك لأسفل</button><button type="button" className={buttonClass} onClick={() => toggleQuestion(question.id)}>إزالة</button></div>
          </li>)}
        </ol> : <p className="text-sm text-slate-600">لم تختاري أي سؤال بعد.</p>}
      </section>
      <button type="submit" disabled={selectedIds.length === 0 || isSubmitting} className="min-h-11 rounded-xl bg-[var(--najoom-navy)] px-5 py-3 font-semibold text-white disabled:opacity-50">{isSubmitting ? "جارٍ الحفظ…" : "حفظ الاختبار"}</button>
    </fieldset>
    {serverError ? <p role="alert" className="text-red-700">{serverError}</p> : null}
  </form>;
}
