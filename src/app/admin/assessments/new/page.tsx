import Link from "next/link";
import { getAssessmentCreationData } from "@/lib/assessments/assessment-service";
import { AssessmentForm } from "../assessment-form";

export default async function NewAssessmentPage() {
  const data = await getAssessmentCreationData();
  return <main dir="rtl" className="min-h-screen bg-[var(--najoom-bg)] px-4 py-8 sm:px-6">
    <div className="mx-auto max-w-4xl space-y-5 text-[var(--najoom-navy)]">
      <Link href="/admin/assessments" className="text-sm underline">العودة إلى الاختبارات</Link>
      <h1 className="text-2xl font-bold sm:text-3xl">إنشاء اختبار</h1>
      <AssessmentForm {...data} />
    </div>
  </main>;
}
