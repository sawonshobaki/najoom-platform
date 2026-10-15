import Link from "next/link";
import { StudentAssessmentAttempt } from "./student-assessment-attempt";

export default async function StudentAssessmentPage({ params }: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await params;
  return <main dir="rtl" className="min-h-screen bg-[var(--najoom-bg)] px-4 py-8 sm:px-6">
    <div className="mx-auto max-w-3xl space-y-5 text-[var(--najoom-navy)]">
      <Link href="/student" className="text-sm underline">العودة إلى مساحة الطالبة</Link>
      <StudentAssessmentAttempt assessmentId={assessmentId} />
    </div>
  </main>;
}
