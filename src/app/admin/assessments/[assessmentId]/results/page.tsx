import Link from "next/link";
import { getAssessmentResults } from "@/lib/assessments/assessment-results-service";

const statusLabels = { DRAFT: "مسودة", PUBLISHED: "منشور", CLOSED: "مغلق", ARCHIVED: "مؤرشف" } as const;
const attemptLabels = { IN_PROGRESS: "قيد الحل", SUBMITTED: "تم التسليم", GRADED: "مصححة" } as const;
const value = (number: number | null, suffix = "") => number === null ? "—" : `${number}${suffix}`;

export default async function AssessmentResultsPage({ params }: { params: Promise<{ assessmentId: string }> }) {
  const results = await getAssessmentResults((await params).assessmentId);
  const cards = [
    ["إجمالي المحاولات", results.totalAttempts], ["المحاولات المصححة", results.gradedAttempts],
    ["متوسط الدرجة", value(results.averageScore)], ["متوسط النسبة", value(results.averagePercentage, "%")],
    ["عدد الأسئلة", results.questionCount], ["الدرجة القصوى", results.maxScore],
  ];
  return <main dir="rtl" className="min-h-screen bg-[var(--najoom-bg)] px-4 py-8 sm:px-6">
    <div className="mx-auto max-w-6xl space-y-6 text-[var(--najoom-navy)]">
      <Link href="/admin/assessments" className="text-sm underline">العودة إلى الاختبارات</Link>
      <header className="min-w-0"><h1 className="break-words text-2xl font-bold sm:text-3xl">نتائج: {results.title}</h1>
        <p className="mt-2 text-slate-600">الدرس: {results.lesson.title} · الحالة: {statusLabels[results.status]}</p></header>
      <dl className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-3">{cards.map(([label, item]) => <div key={String(label)} className="min-w-0 rounded-2xl bg-white p-4 shadow-sm"><dt className="break-words text-sm text-slate-600">{label}</dt><dd className="mt-1 break-words text-xl font-bold">{item}</dd></div>)}</dl>
      <section aria-labelledby="attempt-results" className="min-w-0"><h2 id="attempt-results" className="text-xl font-bold">محاولات الطالبات</h2>
        {results.attempts.length === 0 ? <p className="mt-4 rounded-2xl bg-white p-6 text-slate-600">لا توجد نتائج لهذا الاختبار حتى الآن.</p> :
          <ul className="mt-4 space-y-3">{results.attempts.map(attempt => <li key={attempt.id} className="min-w-0 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-2"><h3 className="break-words font-semibold">{attempt.student.fullName}</h3><span className="rounded-full bg-slate-100 px-3 py-1 text-sm">{attemptLabels[attempt.status]}</span></div>
            <dl className="mt-3 grid min-w-0 gap-2 text-sm sm:grid-cols-3"><div><dt className="text-slate-600">الدرجة</dt><dd>{attempt.score === null || attempt.maxScore === null ? "—" : `${attempt.score} من ${attempt.maxScore}`}</dd></div><div><dt className="text-slate-600">النسبة</dt><dd>{value(attempt.percentage, "%")}</dd></div><div><dt className="text-slate-600">وقت التسليم</dt><dd>{attempt.submittedAt ? <time dateTime={attempt.submittedAt.toISOString()}>{attempt.submittedAt.toLocaleString("ar-JO")}</time> : "لم تُسلّم بعد"}</dd></div></dl>
          </li>)}</ul>}
      </section>
    </div>
  </main>;
}
