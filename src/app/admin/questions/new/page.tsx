import Link from "next/link";
import { getQuestionCreationData } from "@/lib/questions/question-service";
import { QuestionForm } from "../question-form";

export default async function NewQuestionPage() {
  const data = await getQuestionCreationData();
  return <main dir="rtl" className="min-h-screen bg-[var(--najoom-bg)] px-4 py-8 sm:px-6">
    <div className="mx-auto max-w-3xl space-y-5 text-[var(--najoom-navy)]">
      <Link href="/admin/questions" className="text-sm underline">العودة إلى بنك الأسئلة</Link>
      <h1 className="text-2xl font-bold">إضافة سؤال</h1>
      <QuestionForm {...data} />
    </div>
  </main>;
}
