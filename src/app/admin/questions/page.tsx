import Link from "next/link";
import { requireAdmin } from "@/lib/auth/authorization";
import { getQuestionFilterCurriculum, listQuestions } from "@/lib/questions/question-service";
import { parseQuestionQuery, questionListUrl, QuestionReadValidationError, QUESTION_FILTER_KEYS } from "@/lib/questions/question-read-query";
import { QuestionFilters } from "./question-filters";
import { QuestionDeleteButton } from "./question-delete-button";

const typeLabels = { MULTIPLE_CHOICE: "اختيار من متعدد", TRUE_FALSE: "صح أو خطأ", MULTIPLE_SELECT: "اختيار متعدد الإجابات", MATCHING: "مطابقة", ORDERING: "ترتيب", FILL_IN_BLANK: "إكمال الفراغ" };
const difficultyLabels = { EASY: "سهل", MEDIUM: "متوسط", HARD: "صعب" };

export default async function AdminQuestionsPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) for (const item of value) params.append(key, item);
    else if (value !== undefined) params.set(key, value);
  }
  let query;
  let validationMessage;
  try {
    query = parseQuestionQuery(params);
  } catch (error) {
    if (!(error instanceof QuestionReadValidationError)) throw error;
    validationMessage = error.message;
  }
  if (!query) {
    return <main dir="rtl" className="p-6"><h1 className="text-2xl font-bold">بنك الأسئلة</h1>
      <p role="alert" className="my-4">{validationMessage}</p><Link href="/admin/questions" className="underline">إعادة ضبط الفلاتر</Link></main>;
  }
    const [result, curriculum] = await Promise.all([listQuestions(query), getQuestionFilterCurriculum()]);
    const filtered = QUESTION_FILTER_KEYS.some(key => query[key]);
    return <main dir="rtl" className="min-h-screen bg-[var(--najoom-bg)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6 text-[var(--najoom-navy)]">
        <Link href="/admin" className="text-sm underline">العودة إلى لوحة الإدارة</Link>
        <h1 className="text-2xl font-bold sm:text-3xl">بنك الأسئلة</h1>
        <Link href="/admin/questions/new" className="inline-flex rounded-xl bg-[var(--najoom-navy)] px-5 py-3 font-semibold text-white focus:ring-2 focus:ring-[var(--najoom-gold)]">إضافة سؤال</Link>
        <QuestionFilters curriculum={curriculum} query={query} />
        <p role="status">عدد النتائج: {result.total}</p>
        {result.questions.length === 0 ? <p className="rounded-2xl bg-white p-6 text-slate-600">
          {result.total > 0 ? "لا توجد أسئلة في هذه الصفحة." : filtered ? "لا توجد أسئلة تطابق الفلاتر المحددة." : "لا توجد أسئلة في بنك الأسئلة حتى الآن."}
        </p> : <ul aria-label="قائمة الأسئلة" className="space-y-4">
          {result.questions.map(question => <li key={question.id} className="min-w-0 rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
            <h2 className="whitespace-pre-wrap break-words font-semibold">{question.text}</h2>
            <p className="mt-2 break-words text-sm text-slate-600">
              {question.lesson.unit.semester.grade.name} ← {question.lesson.unit.semester.name} <bdi dir="ltr" className="whitespace-nowrap">({question.lesson.unit.semester.academicYear})</bdi> ← {question.lesson.unit.title} ← {question.lesson.title}
            </p>
            <p className="mt-2 text-sm">النوع: {typeLabels[question.type]} · الصعوبة: {difficultyLabels[question.difficulty]} · عدد الخيارات: {question.optionCount}</p>
            {question.learningObjective ? <p className="mt-2 break-words text-sm">الهدف التعليمي: {question.learningObjective.title}</p> : null}
            {question.type === "MULTIPLE_CHOICE" || question.type === "TRUE_FALSE" ? <div className="mt-4 flex flex-wrap items-start gap-3">
              {question.isUsed ? <span className="py-2 text-sm text-slate-600">السؤال مستخدم في تقييم؛ التعديل والحذف غير متاحين.</span>
                : <Link href={`/admin/questions/${encodeURIComponent(question.id)}/edit`} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 underline">تعديل</Link>}
              <QuestionDeleteButton questionId={question.id} isUsed={question.isUsed} />
            </div> : null}
          </li>)}
        </ul>}
        {result.totalPages > 1 || query.page > 1 ? <nav aria-label="صفحات الأسئلة" className="flex flex-wrap items-center gap-4">
          {query.page > 1 ? <Link className="rounded-xl bg-white px-4 py-3 underline" href={questionListUrl(query, Math.min(query.page - 1, Math.max(1, result.totalPages)))}>السابق</Link> : null}
          <span>الصفحة {query.page} من {Math.max(1, result.totalPages)}</span>
          {query.page < result.totalPages && query.page < 10000 ? <Link className="rounded-xl bg-white px-4 py-3 underline" href={questionListUrl(query, query.page + 1)}>التالي</Link> : null}
        </nav> : null}
      </div>
    </main>;
}
