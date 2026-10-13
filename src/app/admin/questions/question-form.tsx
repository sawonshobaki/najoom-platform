"use client";

import { useId, useReducer, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { QuestionDifficulty } from "@/generated/prisma/enums";
import type { QuestionCreationData } from "@/lib/questions/question-service";
import { validateQuestionCreateRequest, QuestionValidationError, type V1QuestionType, type QuestionCreateRequest } from "@/lib/questions/question-validation";
import { buildQuestionCreatePayload, initialQuestionOptions, questionOptionsReducer } from "./question-form-state";

export function TrueFalseAnswer({ name, value, onChange }: { name: string; value: boolean | null; onChange: (value: boolean) => void }) {
  return <fieldset className="min-w-0 space-y-3">
    <legend className="font-semibold">حددي الإجابة الصحيحة</legend>
    {[{ value: true, label: "صحيح" }, { value: false, label: "خطأ" }].map(choice => <label key={String(choice.value)} className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 p-3">
      <input type="radio" name={name} value={String(choice.value)} checked={value === choice.value} required onChange={() => onChange(choice.value)} />{choice.label}
    </label>)}
  </fieldset>;
}

export function QuestionForm({ curriculum, objectives }: QuestionCreationData) {
  const router = useRouter();
  const formId = useId();
  const [gradeId, setGradeId] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [objectiveId, setObjectiveId] = useState("");
  const [text, setText] = useState("");
  const [explanation, setExplanation] = useState("");
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>("MEDIUM");
  const [type, setType] = useState<V1QuestionType>("MULTIPLE_CHOICE");
  const [correctAnswer, setCorrectAnswer] = useState<boolean | null>(null);
  const [options, dispatch] = useReducer(questionOptionsReducer, initialQuestionOptions);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState("");
  const semesters = curriculum.find(g => g.id === gradeId)?.semesters ?? [];
  const units = semesters.find(s => s.id === semesterId)?.units ?? [];
  const lessons = units.find(u => u.id === unitId)?.lessons ?? [];
  const lessonObjectives = objectives.filter(o => o.lessonId === lessonId);
  const inputClass = "mt-1 min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white p-3 focus:ring-2 focus:ring-[var(--najoom-gold)]";
  const buttonClass = "rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-40 focus:ring-2 focus:ring-[var(--najoom-gold)]";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError("");
    const common = {
      lessonId, learningObjectiveId: objectiveId || null, text, explanation,
      difficulty,
    };
    let payload: QuestionCreateRequest;
    try {
      payload = buildQuestionCreatePayload(common, type, options, correctAnswer);
      validateQuestionCreateRequest(payload);
    }
    catch (error) { setError(error instanceof QuestionValidationError ? error.message : "راجعي بيانات السؤال."); return; }
    submitting.current = true;
    setPending(true);
    try {
      const response = await fetch("/api/admin/questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || !body || typeof body !== "object" || !("success" in body) || body.success !== true) {
        setError(body && typeof body === "object" && "message" in body && typeof body.message === "string" ? body.message : "تعذر حفظ السؤال. حاولي مرة أخرى.");
        return;
      }
      router.push("/admin/questions");
      router.refresh();
    } catch { setError("تعذر الاتصال بالمنصة. حاولي مرة أخرى."); }
    finally { submitting.current = false; setPending(false); }
  }

  const selectors = [
    { key: "grade", label: "الصف", value: gradeId, disabled: false, items: curriculum.map(g => ({ id: g.id, title: g.name })), change: (id: string) => { setGradeId(id); setSemesterId(""); setUnitId(""); setLessonId(""); setObjectiveId(""); } },
    { key: "semester", label: "الفصل الدراسي", value: semesterId, disabled: !gradeId, items: semesters.map(s => ({ id: s.id, title: `${s.name} (${s.academicYear})` })), change: (id: string) => { setSemesterId(id); setUnitId(""); setLessonId(""); setObjectiveId(""); } },
    { key: "unit", label: "الوحدة", value: unitId, disabled: !semesterId, items: units, change: (id: string) => { setUnitId(id); setLessonId(""); setObjectiveId(""); } },
    { key: "lesson", label: "الدرس", value: lessonId, disabled: !unitId, items: lessons, change: (id: string) => { setLessonId(id); setObjectiveId(""); } },
  ];
  return <form dir="rtl" onSubmit={submit} aria-label="إنشاء سؤال" aria-busy={pending} className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
    <fieldset disabled={pending} className="min-w-0 space-y-5">
      <legend className="sr-only">بيانات السؤال</legend>
      <div><label htmlFor={`${formId}-type`}>نوع السؤال</label><select id={`${formId}-type`} value={type} onChange={e => { setType(e.target.value as V1QuestionType); setError(""); }} className={inputClass}>
        <option value="MULTIPLE_CHOICE">اختيار من متعدد</option><option value="TRUE_FALSE">صح أو خطأ</option>
      </select></div>
      <div className="grid gap-4 sm:grid-cols-2">
        {selectors.map(selector => <div key={selector.key} className="min-w-0">
          <label htmlFor={`${formId}-${selector.key}`}>{selector.label}</label>
          <select id={`${formId}-${selector.key}`} value={selector.value} disabled={selector.disabled} required className={inputClass} onChange={e => selector.change(e.target.value)}>
            <option value="">اختاري {selector.label}</option>
            {selector.items.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </div>)}
      </div>
      <div>
        <label htmlFor={`${formId}-objective`}>الهدف التعليمي (اختياري)</label>
        <select id={`${formId}-objective`} value={objectiveId} onChange={e => setObjectiveId(e.target.value)} disabled={!lessonId || !lessonObjectives.length} className={inputClass}>
          <option value="">بدون هدف تعليمي</option>
          {lessonObjectives.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
        </select>
        {lessonId && !lessonObjectives.length ? <p className="mt-2 text-sm text-slate-600">لا توجد أهداف تعليمية لهذا الدرس</p> : null}
      </div>
      <div><label htmlFor={`${formId}-text`}>نص السؤال</label><textarea id={`${formId}-text`} value={text} onChange={e => setText(e.target.value)} required maxLength={5000} rows={4} className={inputClass} /></div>
      <div><label htmlFor={`${formId}-explanation`}>شرح الإجابة (اختياري)</label><textarea id={`${formId}-explanation`} value={explanation} onChange={e => setExplanation(e.target.value)} maxLength={5000} rows={3} className={inputClass} /></div>
      <div><label htmlFor={`${formId}-difficulty`}>الصعوبة</label><select id={`${formId}-difficulty`} value={difficulty} onChange={e => setDifficulty(e.target.value as QuestionDifficulty)} className={inputClass}>
        <option value="EASY">سهل</option><option value="MEDIUM">متوسط</option><option value="HARD">صعب</option>
      </select></div>
      {type === "TRUE_FALSE" ? <TrueFalseAnswer name={`${formId}-true-false`} value={correctAnswer} onChange={setCorrectAnswer} /> : <fieldset className="min-w-0 space-y-3">
        <legend className="font-semibold">الخيارات — حددي إجابة صحيحة واحدة</legend>
        {options.map((option, index) => <div key={option.key} className="min-w-0 rounded-xl border border-slate-200 p-3">
          <label htmlFor={`${formId}-option-${option.key}`}>الخيار {index + 1}</label>
          <input id={`${formId}-option-${option.key}`} value={option.text} onChange={e => dispatch({ type: "text", key: option.key, text: e.target.value })} required maxLength={500} className={inputClass} />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2"><input type="radio" name={`${formId}-correct`} value={option.key} checked={option.isCorrect} required onChange={() => dispatch({ type: "correct", key: option.key })} />الإجابة الصحيحة للخيار {index + 1}</label>
            <button type="button" aria-label={`تحريك الخيار ${index + 1} لأعلى`} disabled={index === 0} onClick={() => dispatch({ type: "move", key: option.key, direction: -1 })} className={buttonClass}>أعلى</button>
            <button type="button" aria-label={`تحريك الخيار ${index + 1} لأسفل`} disabled={index === options.length - 1} onClick={() => dispatch({ type: "move", key: option.key, direction: 1 })} className={buttonClass}>أسفل</button>
            <button type="button" aria-label={`حذف الخيار ${index + 1}`} disabled={options.length <= 2} onClick={() => dispatch({ type: "remove", key: option.key })} className={buttonClass}>حذف الخيار</button>
          </div>
        </div>)}
        <button type="button" disabled={options.length >= 6} onClick={() => dispatch({ type: "add" })} className={buttonClass}>إضافة خيار</button>
      </fieldset>}
      <button type="submit" className="min-h-11 rounded-xl bg-[var(--najoom-navy)] px-5 py-3 font-semibold text-white disabled:opacity-50">{pending ? "جارٍ الحفظ…" : "حفظ السؤال"}</button>
    </fieldset>
    {error ? <p role="alert" className="mt-4 text-red-700">{error}</p> : null}
  </form>;
}
