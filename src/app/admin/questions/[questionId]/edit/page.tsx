import Link from "next/link";
import { notFound } from "next/navigation";
import { getQuestion, getQuestionCreationData, QuestionMutationError } from "@/lib/questions/question-service";
import { QuestionForm } from "../../question-form";

export default async function EditQuestionPage({ params }: { params: Promise<{ questionId: string }> }) {
  const { questionId } = await params;
  const question = await getQuestion(questionId).catch(error => {
    if (error instanceof QuestionMutationError && error.code === "question_not_found") notFound();
    throw error;
  });
  const supported = question.type === "MULTIPLE_CHOICE" || question.type === "TRUE_FALSE";
  const data = !question.isUsed && supported ? await getQuestionCreationData() : null;
  return <main dir="rtl" className="min-h-screen bg-[var(--najoom-bg)] px-4 py-8 sm:px-6">
    <div className="mx-auto max-w-3xl space-y-5 text-[var(--najoom-navy)]">
      <Link href="/admin/questions" className="underline">العودة إلى بنك الأسئلة</Link>
      <h1 className="text-2xl font-bold">تعديل السؤال</h1>
      {question.isUsed ? <p role="status" className="rounded-xl bg-white p-5">لا يمكن تعديل هذا السؤال لأنه مستخدم في تقييم.</p>
        : data ? <QuestionForm key={question.id} {...data} question={question} />
        : <p role="status">نوع السؤال غير مدعوم للتعديل في هذه المرحلة.</p>}
    </div>
  </main>;
}
