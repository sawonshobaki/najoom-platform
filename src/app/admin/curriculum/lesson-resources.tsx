import type { LessonResourceType } from "@/generated/prisma/enums";
import { LessonResourceForm } from "./lesson-resource-form";

type Resource = {
  id: string; title: string; url: string; type: LessonResourceType; language: string;
  isFree: boolean; instructionsArabic: string | null; sortOrder: number;
};
const typeLabels: Record<LessonResourceType, string> = { VIDEO: "فيديو", GAME: "لعبة", SIMULATION: "محاكاة", ARTICLE: "مقالة" };

export function LessonResources({ lessonId, resources }: { lessonId: string; resources: Resource[] }) {
  return (
    <section className="mt-3 rounded-xl border border-slate-200 p-3">
      <h6 className="font-semibold text-[var(--najoom-navy)]">الموارد التفاعلية</h6>
      <details className="mt-2">
        <summary className="cursor-pointer font-medium text-[var(--najoom-navy)]">إضافة مورد</summary>
        <LessonResourceForm lessonId={lessonId} />
      </details>
      {resources.length === 0 ? <p className="mt-2 text-slate-500">لا توجد موارد تفاعلية مسجلة لهذا الدرس.</p> : (
        <ol className="mt-3 space-y-3">
          {resources.map((resource) => (
            <li key={resource.id} className="border-s-2 border-[var(--najoom-gold)] ps-3">
              <p className="break-words font-semibold text-[var(--najoom-navy)]">{resource.title}</p>
              <p className="mt-1">النوع: {typeLabels[resource.type]} · اللغة: {resource.language} · {resource.isFree ? "مجاني" : "غير مجاني"}</p>
              <p className="mt-1">ترتيب المورد: {resource.sortOrder}</p>
              <a href={resource.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block break-all text-[var(--najoom-navy)] underline">
                رابط المصدر: <bdi dir="ltr">{resource.url}</bdi>
              </a>
              {resource.instructionsArabic ? <p className="mt-2 whitespace-pre-wrap break-words">التعليمات العربية: {resource.instructionsArabic}</p> : null}
              <details className="mt-2">
                <summary className="cursor-pointer font-medium text-[var(--najoom-navy)]">تعديل المورد</summary>
                <LessonResourceForm lessonId={lessonId} resource={resource} />
              </details>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
