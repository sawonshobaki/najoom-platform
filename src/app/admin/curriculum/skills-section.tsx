import { SkillForm } from "./skill-form";

type Skill = { id: string; name: string; description: string | null };

export function SkillsSection({ skills }: { skills: Skill[] }) {
  return (
    <section aria-labelledby="curriculum-skills" className="mb-6 rounded-3xl border border-black/5 bg-white p-5 shadow-sm sm:p-6">
      <h2 id="curriculum-skills" className="text-xl font-bold text-[var(--najoom-navy)]">إدارة المهارات</h2>
      <details className="mt-3 rounded-xl border border-slate-200 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-[var(--najoom-navy)]">إضافة مهارة</summary>
        <SkillForm />
      </details>
      {skills.length === 0 ? <p className="mt-3 text-sm text-slate-500">لا توجد مهارات مسجلة حاليًا.</p> : (
        <ul className="mt-4 space-y-4 text-sm">
          {skills.map((skill) => (
            <li key={skill.id} className="border-s-2 border-[var(--najoom-gold)] ps-3">
              <p className="break-words font-semibold text-[var(--najoom-navy)]">{skill.name}</p>
              {skill.description ? <p className="mt-1 whitespace-pre-wrap break-words text-slate-600">{skill.description}</p> : null}
              <details className="mt-2">
                <summary className="cursor-pointer font-medium text-[var(--najoom-navy)]">تعديل المهارة</summary>
                <SkillForm skill={skill} />
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
