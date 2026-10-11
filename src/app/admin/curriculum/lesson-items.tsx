import { LessonItemForm } from "./lesson-item-form";

type LessonItem = { id: string; title: string; description: string | null };
type LessonItemsProps = { lessonId: string; concepts: LessonItem[]; learningObjectives: LessonItem[] };

export function LessonItems({ lessonId, concepts, learningObjectives }: LessonItemsProps) {
  const groups = [
    { kind: "concept" as const, heading: "المفاهيم", label: "المفهوم", items: concepts, empty: "لا توجد مفاهيم مسجلة لهذا الدرس." },
    { kind: "objective" as const, heading: "الأهداف التعليمية", label: "الهدف التعليمي", items: learningObjectives, empty: "لا توجد أهداف تعليمية مسجلة لهذا الدرس." },
  ];
  return (
    <div className="mt-3 space-y-3">
      {groups.map((group) => (
        <section key={group.kind} className="rounded-xl border border-slate-200 p-3">
          <h6 className="font-semibold text-[var(--najoom-navy)]">{group.heading}</h6>
          <details className="mt-2">
            <summary className="cursor-pointer font-medium text-[var(--najoom-navy)]">إضافة {group.label}</summary>
            <LessonItemForm kind={group.kind} lessonId={lessonId} />
          </details>
          {group.items.length === 0 ? <p className="mt-2 text-slate-500">{group.empty}</p> : (
            <ul className="mt-3 space-y-3">
              {group.items.map((item) => (
                <li key={item.id} className="border-s-2 border-[var(--najoom-gold)] ps-3">
                  <p className="font-semibold text-[var(--najoom-navy)]">{item.title}</p>
                  {item.description ? <p className="mt-1 whitespace-pre-wrap break-words">{item.description}</p> : null}
                  <details className="mt-2">
                    <summary className="cursor-pointer font-medium text-[var(--najoom-navy)]">تعديل {group.label}</summary>
                    <LessonItemForm kind={group.kind} lessonId={lessonId} item={item} />
                  </details>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
