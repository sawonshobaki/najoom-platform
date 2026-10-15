import Link from "next/link";
import { listAssignmentReviews } from "@/lib/assignments/assignment-review-service";
import { AssignmentReviewList } from "./assignment-review-list";

export default async function AssignmentReviewsPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  const data = await listAssignmentReviews(assignmentId);
  return <main dir="rtl" className="min-h-screen bg-[var(--najoom-bg)] px-4 py-8 sm:px-6">
    <div className="mx-auto max-w-5xl space-y-6 text-[var(--najoom-navy)]">
      <Link href="/admin/assignments" className="text-sm underline">العودة إلى الواجبات</Link>
      <section className="min-w-0 rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-600">الأسبوع {data.assignment.weekNumber}</p>
        <h1 className="mt-1 break-words text-2xl font-bold sm:text-3xl">مراجعة: {data.assignment.title}</h1>
        <p className="mt-2 text-sm text-slate-600">الدرس: {data.assignment.lessonTitle}</p>
        {data.assignment.description ? <p className="mt-3 whitespace-pre-wrap break-words">{data.assignment.description}</p> : null}
        <a href={data.assignment.externalUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex max-w-full break-all underline">فتح رابط الواجب</a>
      </section>
      <AssignmentReviewList assignmentId={assignmentId} initialStudents={data.students} />
    </div>
  </main>;
}
