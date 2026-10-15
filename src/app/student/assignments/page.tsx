import Link from "next/link";
import { listStudentAssignments } from "@/lib/assignments/assignment-service";
import { groupAssignmentsByWeek } from "@/lib/assignments/assignment-groups";

export default async function StudentAssignmentsPage() {
  const assignments = await listStudentAssignments();
  return <main dir="rtl" className="min-h-screen bg-[var(--najoom-bg)] px-4 py-8 sm:px-6"><div className="mx-auto max-w-4xl space-y-6 text-[var(--najoom-navy)]"><Link href="/student" className="text-sm underline">العودة إلى مساحة الطالبة</Link><h1 className="text-2xl font-bold sm:text-3xl">واجباتي</h1>
    {assignments.length === 0 ? <p className="rounded-2xl bg-white p-6 text-slate-600">لا توجد واجبات متاحة لكِ حتى الآن.</p> : <div className="space-y-6">{groupAssignmentsByWeek(assignments).map(group => <section key={group.weekNumber} aria-labelledby={`student-week-${group.weekNumber}`}><h2 id={`student-week-${group.weekNumber}`} className="mb-3 text-xl font-bold">الأسبوع {group.weekNumber}</h2><ul className="space-y-3">{group.items.map(assignment => <li key={assignment.id} className="min-w-0 rounded-2xl bg-white p-5 shadow-sm"><h3 className="break-words text-lg font-semibold">{assignment.title}</h3><p className="mt-2 text-sm text-slate-600">الدرس: {assignment.lesson.title}</p>{assignment.description ? <p className="mt-3 whitespace-pre-wrap break-words">{assignment.description}</p> : null}<a href={assignment.externalUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 max-w-full items-center rounded-xl bg-[var(--najoom-navy)] px-5 py-3 font-semibold text-white">فتح الواجب</a></li>)}</ul></section>)}</div>}
  </div></main>;
}
