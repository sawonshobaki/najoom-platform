"use client";

import { useState } from "react";
import type { AssessmentAttemptResult, StudentAttemptPayload } from "@/lib/assessments/attempt-service";

export function StudentAssessmentAttempt({ assessmentId }: { assessmentId: string }) {
  const [attempt, setAttempt] = useState<StudentAttemptPayload | null>(null);
  const [result, setResult] = useState<AssessmentAttemptResult | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState(false);
  const [savingQuestion, setSavingQuestion] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function responseBody(response: Response) {
    return await response.json().catch(() => null) as Record<string, unknown> | null;
  }
  function message(body: Record<string, unknown> | null, fallback: string) {
    return body && typeof body.message === "string" ? body.message : fallback;
  }

  async function start() {
    if (pending) return;
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/student/assessments/${encodeURIComponent(assessmentId)}/attempts`, { method: "POST" });
      const body = await responseBody(response);
      if (!response.ok || !body || body.success !== true || !body.attempt) { setError(message(body, "تعذر بدء الاختبار.")); return; }
      setAttempt(body.attempt as StudentAttemptPayload);
    } catch { setError("تعذر الاتصال بالمنصة. حاولي مرة أخرى."); }
    finally { setPending(false); }
  }

  async function choose(assessmentQuestionId: string, optionId: string) {
    if (!attempt || savingQuestion) return;
    const previous = selected[assessmentQuestionId];
    setSelected(current => ({ ...current, [assessmentQuestionId]: optionId }));
    setSaved(current => ({ ...current, [assessmentQuestionId]: false }));
    setSavingQuestion(assessmentQuestionId); setError("");
    try {
      const response = await fetch(`/api/student/assessment-attempts/${encodeURIComponent(attempt.attemptId)}/answers/${encodeURIComponent(assessmentQuestionId)}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ optionId }),
      });
      const body = await responseBody(response);
      if (!response.ok || !body || body.success !== true) {
        setSelected(current => { const next = { ...current }; if (previous) next[assessmentQuestionId] = previous; else delete next[assessmentQuestionId]; return next; });
        setError(message(body, "تعذر حفظ الإجابة.")); return;
      }
      setSaved(current => ({ ...current, [assessmentQuestionId]: true }));
    } catch {
      setSelected(current => { const next = { ...current }; if (previous) next[assessmentQuestionId] = previous; else delete next[assessmentQuestionId]; return next; });
      setError("تعذر الاتصال بالمنصة. حاولي مرة أخرى.");
    } finally { setSavingQuestion(null); }
  }

  async function submit() {
    if (!attempt || pending || savingQuestion || !window.confirm("هل أنتِ متأكدة من تسليم الاختبار؟ يمكنكِ التسليم حتى مع وجود أسئلة بلا إجابة.")) return;
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/student/assessment-attempts/${encodeURIComponent(attempt.attemptId)}/submit`, { method: "POST" });
      const body = await responseBody(response);
      if (!response.ok || !body || body.success !== true || !body.result) { setError(message(body, "تعذر تسليم الاختبار.")); return; }
      setResult(body.result as AssessmentAttemptResult);
    } catch { setError("تعذر الاتصال بالمنصة. حاولي مرة أخرى."); }
    finally { setPending(false); }
  }

  if (result) return <section aria-labelledby="result-title" className="rounded-2xl bg-white p-5 shadow-sm sm:p-7">
    <h1 id="result-title" className="text-2xl font-bold">نتيجة الاختبار</h1>
    <p className="mt-4 text-lg font-semibold">{result.earnedPoints} من {result.totalPoints} نقطة</p>
    <p className="mt-2">النسبة: <bdi dir="ltr">{result.percentage}%</bdi></p>
    <p className="mt-2">الإجابات الصحيحة: {result.correctCount} من {result.questionCount}</p>
    <ul aria-label="نتائج الأسئلة" className="mt-5 space-y-2">{result.questionResults.map((item, index) => <li key={item.assessmentQuestionId} className="rounded-xl bg-slate-50 p-3">السؤال {index + 1}: {item.answered ? item.correct ? "إجابة صحيحة" : "تحتاج إلى مراجعة" : "بلا إجابة"} · {item.awardedPoints} من {item.points}</li>)}</ul>
  </section>;

  if (!attempt) return <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-7">
    <h1 className="text-2xl font-bold">الاختبار</h1><p className="mt-3 text-slate-600">ابدئي عندما تكونين جاهزة. هذا الاختبار غير موقّت.</p>
    <button type="button" onClick={start} disabled={pending} className="mt-5 min-h-11 rounded-xl bg-[var(--najoom-navy)] px-5 py-3 font-semibold text-white disabled:opacity-50">{pending ? "جارٍ البدء…" : "ابدئي الاختبار"}</button>
    {error ? <p role="alert" className="mt-4 text-red-700">{error}</p> : null}
  </section>;

  return <section aria-labelledby="assessment-title" className="min-w-0 space-y-5">
    <div className="rounded-2xl bg-white p-5 shadow-sm"><h1 id="assessment-title" className="break-words text-2xl font-bold">{attempt.assessment.title}</h1><p className="mt-2 text-slate-600">الدرس: {attempt.assessment.lesson.title}</p><p className="mt-2 text-sm">غير موقّت · {attempt.questions.length} سؤال</p></div>
    <ol className="space-y-4">{attempt.questions.map((question, index) => <li key={question.id} className="min-w-0 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
      <fieldset disabled={savingQuestion === question.id} className="min-w-0"><legend className="whitespace-pre-wrap break-words font-semibold">{index + 1}. {question.text} <span className="text-sm font-normal text-slate-600">({question.points} نقطة)</span></legend>
        <div className="mt-4 space-y-2">{question.options.map(option => <label key={option.id} className="flex min-h-11 min-w-0 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3"><input type="radio" name={`question-${question.id}`} value={option.id} checked={selected[question.id] === option.id} onChange={() => choose(question.id, option.id)} className="size-5 shrink-0" /><span className="break-words">{option.text}</span></label>)}</div>
      </fieldset><p role="status" className="mt-3 text-sm text-slate-600">{savingQuestion === question.id ? "جارٍ حفظ الإجابة…" : saved[question.id] ? "تم حفظ الإجابة" : selected[question.id] ? "تعذر حفظ الإجابة" : "لم تتم الإجابة بعد"}</p>
    </li>)}</ol>
    <button type="button" onClick={submit} disabled={pending || Boolean(savingQuestion)} className="min-h-11 rounded-xl bg-[var(--najoom-navy)] px-5 py-3 font-semibold text-white disabled:opacity-50">{pending ? "جارٍ التسليم…" : "تسليم الاختبار"}</button>
    {error ? <p role="alert" className="rounded-xl bg-white p-3 text-red-700">{error}</p> : null}
  </section>;
}
