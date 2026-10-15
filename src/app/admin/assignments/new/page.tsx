import Link from "next/link";
import { getAssignmentCreationData } from "@/lib/assignments/assignment-service";
import { AssignmentForm } from "../assignment-form";

export default async function NewAssignmentPage() {
  const curriculum = await getAssignmentCreationData();
  return <main dir="rtl" className="min-h-screen bg-[var(--najoom-bg)] px-4 py-8 sm:px-6"><div className="mx-auto max-w-4xl space-y-5 text-[var(--najoom-navy)]"><Link href="/admin/assignments" className="text-sm underline">العودة إلى الواجبات</Link><h1 className="text-2xl font-bold sm:text-3xl">إضافة واجب</h1><AssignmentForm curriculum={curriculum} /></div></main>;
}
