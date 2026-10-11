import { LessonResourceCard, type LessonResourceCardProps } from "@/components/curriculum/lesson-resource-card";

type ResourcePreviewProps = {
  resource?: Omit<LessonResourceCardProps, "compact" | "preview">;
};

export function ResourceExperiencePreview({ resource }: ResourcePreviewProps) {
  return (
    <details className="mb-6 rounded-2xl border border-slate-200 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold text-[var(--najoom-navy)]">معاينة تجربة الموارد للطالبة</summary>
      <p className="mb-3 mt-2 text-sm leading-6 text-slate-600">
        {resource ? "معاينة مورد موجود في المنهج كما سيظهر للطالبة." : "معاينة فقط؛ لم تُضف موارد إلى المنهج بعد. لا تُنشئ هذه المعاينة بيانات."}
      </p>
      <LessonResourceCard {...(resource ?? {
        title: "معاينة مورد فيديو", url: "", type: "VIDEO", language: "العربية", isFree: true,
      })} compact preview={!resource} />
    </details>
  );
}
