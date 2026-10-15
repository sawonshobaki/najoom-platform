import Link from "next/link";
import { listAssessments } from "@/lib/assessments/assessment-service";

const statusLabels = { DRAFT: "مسودة", PUBLISHED: "منشور", CLOSED: "مغلق", ARCHIVED: "مؤرشف" };

export default async function AdminAssessmentsPage() {
  const assessments = await listAssessments();
  return <main dir="rtl" className="min-h-screen bg-[var(--najoom-bg)] px-4 py-8 sm:px-6">
    <div className="mx-auto max-w-5xl space-y-6 text-[var(--najoom-navy)]">
      <Link href="/admin" className="text-sm underline">العودة إلى لوحة الإدارة</Link>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold sm:text-3xl">الاختبارات</h1>
        <Link href="/admin/assessments/new" className="inline-flex min-h-11 items-center rounded-xl bg-[var(--najoom-navy)] px-5 py-3 font-semibold text-white focus:ring-2 focus:ring-[var(--najoom-gold)]">إنشاء اختبار</Link>
      </div>
      <p role="status">عدد الاختبارات: {assessments.length}</p>
      {assessments.length === 0 ? <p className="rounded-2xl bg-white p-6 text-slate-600">لا توجد اختبارات حتى الآن.</p> :
        <ul aria-label="قائمة الاختبارات" className="space-y-4">
          {assessments.map(assessment => <li key={assessment.id} className="min-w-0 rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
            <h2 className="break-words text-lg font-semibold">{assessment.title}</h2>
            <p className="mt-2 break-words text-sm text-slate-600">
              {assessment.lesson.unit.semester.grade.name} ← {assessment.lesson.unit.semester.name} <bdi dir="ltr" className="whitespace-nowrap">({assessment.lesson.unit.semester.academicYear})</bdi> ← {assessment.lesson.unit.title} ← {assessment.lesson.title}
            </p>
            <p className="mt-2 text-sm">الأسئلة: {assessment.questionCount} · مجموع النقاط: {assessment.totalPoints} · الحالة: {statusLabels[assessment.status]}</p>
            <p className="mt-2 text-sm text-slate-600">تاريخ الإنشاء: <time dateTime={assessment.createdAt.toISOString()}>{assessment.createdAt.toLocaleDateString("ar-JO")}</time></p>
          </li>)}
        </ul>}
    </div>
  </main>;
}
