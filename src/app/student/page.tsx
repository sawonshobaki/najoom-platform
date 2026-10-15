import Link from "next/link";
import { OulaGuide } from "@/components/oula/oula-guide";
import { getOulaMessage } from "@/components/oula/oula-content";
import { getStudentDashboardData } from "@/lib/student-dashboard/student-dashboard-service";

function scoreLabel(score: 0 | 1 | null) {
  return score === null ? "لم يتم التقييم بعد" : `${score} نقطة`;
}

export default async function StudentHomePage() {
  const data = await getStudentDashboardData();
  return <main dir="rtl" className="min-h-screen bg-[var(--najoom-bg)] px-4 py-8 sm:px-6">
    <div className="mx-auto max-w-6xl space-y-7 text-[var(--najoom-navy)]">
      <header className="grid gap-4 rounded-3xl border border-black/5 bg-white p-5 shadow-sm sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--najoom-gold)]">منصة نجوم</p>
          <h1 className="mt-2 break-words text-2xl font-bold sm:text-3xl">أهلًا {data.student.fullName}</h1>
          {data.student.grade ? <p className="mt-2 text-slate-600">{data.student.grade.name} · الشعبة {data.student.section?.name}</p> : <p className="mt-2 text-amber-700">لم يتم تعيين شعبة لكِ بعد.</p>}
        </div>
        <OulaGuide state="WELCOME" studentName={data.student.fullName} message={getOulaMessage("WELCOME")} compact />
      </header>

      <nav aria-label="روابط سريعة" className="grid gap-3 sm:grid-cols-2">
        <Link href="/student/assignments" className="flex min-h-14 items-center justify-center rounded-2xl bg-[var(--najoom-navy)] px-5 py-3 font-semibold text-white">الواجبات</Link>
        <Link href="#available-assessments" className="flex min-h-14 items-center justify-center rounded-2xl border border-[var(--najoom-blue)] bg-white px-5 py-3 font-semibold">الاختبارات المتاحة</Link>
      </nav>

      <section aria-labelledby="progress-heading">
        <h2 id="progress-heading" className="text-xl font-bold sm:text-2xl">ملخص تقدّمكِ</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <article className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-600">اختبارات مكتملة</p><p className="mt-2 text-2xl font-bold">{data.summary.completedAssessments}</p></article>
          <article className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-600">متوسط الاختبارات</p><p className="mt-2 text-2xl font-bold"><bdi dir="ltr">{data.summary.assessmentAverage}%</bdi></p></article>
          <article className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-600">نقاط الواجبات</p><p className="mt-2 text-2xl font-bold">{data.summary.assignmentEarnedPoints} من {data.summary.gradedAssignments}</p></article>
        </div>
      </section>

      <div className="grid gap-7 lg:grid-cols-2">
        <section aria-labelledby="assignments-heading">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="assignments-heading" className="text-xl font-bold sm:text-2xl">أحدث الواجبات</h2><Link href="/student/assignments" className="text-sm underline">عرض الأرشيف</Link></div>
          {data.assignments.length ? <ul className="mt-3 space-y-3">{data.assignments.map(assignment => <li key={assignment.id} className="min-w-0 rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">الأسبوع {assignment.weekNumber}</p><h3 className="mt-1 break-words text-lg font-semibold">{assignment.title}</h3><p className="mt-1 break-words text-sm text-slate-600">الدرس: {assignment.lessonTitle}</p><p className="mt-2 font-semibold">{scoreLabel(assignment.score)}</p>
            <a href={assignment.externalUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 max-w-full items-center rounded-xl bg-[var(--najoom-navy)] px-4 py-2 font-semibold text-white">فتح الواجب</a>
          </li>)}</ul> : <p className="mt-3 rounded-2xl bg-white p-5 text-slate-600">لا توجد واجبات متاحة حاليًا.</p>}
        </section>

        <section id="available-assessments" aria-labelledby="assessments-heading">
          <h2 id="assessments-heading" className="text-xl font-bold sm:text-2xl">الاختبارات المتاحة</h2>
          {data.availableAssessments.length ? <ul className="mt-3 space-y-3">{data.availableAssessments.map(assessment => <li key={assessment.id} className="min-w-0 rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="break-words text-lg font-semibold">{assessment.title}</h3><p className="mt-1 break-words text-sm text-slate-600">الدرس: {assessment.lessonTitle}</p><p className="mt-1 text-sm text-slate-600">عدد الأسئلة: {assessment.questionCount}</p>
            <Link href={`/student/assessments/${assessment.id}`} className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-[var(--najoom-blue)] px-4 py-2 font-semibold text-white">ابدئي الاختبار</Link>
          </li>)}</ul> : <p className="mt-3 rounded-2xl bg-white p-5 text-slate-600">لا توجد اختبارات متاحة حاليًا.</p>}
        </section>
      </div>

      <section aria-labelledby="results-heading">
        <h2 id="results-heading" className="text-xl font-bold sm:text-2xl">النتائج الأخيرة</h2>
        {data.recentResults.length ? <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.recentResults.map(result => <li key={result.id} className="min-w-0 rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="break-words font-semibold">{result.title}</h3><p className="mt-2"><bdi dir="ltr">{result.score}/{result.maxScore} · {result.percentage}%</bdi></p><time className="mt-2 block text-sm text-slate-500" dateTime={result.submittedAt.toISOString()}>{result.submittedAt.toLocaleDateString("ar-JO")}</time>
        </li>)}</ul> : <p className="mt-3 rounded-2xl bg-white p-5 text-slate-600">لا توجد نتائج بعد.</p>}
      </section>
    </div>
  </main>;
}
