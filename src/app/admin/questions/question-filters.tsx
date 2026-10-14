"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { QuestionFilterCurriculum } from "@/lib/questions/question-service";
import { questionListUrl, type QuestionListQuery } from "@/lib/questions/question-read-query";

export function QuestionFilters({ curriculum, query }: { curriculum: QuestionFilterCurriculum; query: QuestionListQuery }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const semesters = curriculum.filter(g => !query.gradeId || g.id === query.gradeId).flatMap(g => g.semesters);
  const units = semesters.filter(s => !query.semesterId || s.id === query.semesterId).flatMap(s => s.units);
  const lessons = units.filter(u => !query.unitId || u.id === query.unitId).flatMap(u => u.lessons);
  const filters = [
    { key: "gradeId", label: "الصف", options: curriculum.map(g => ({ id: g.id, label: g.name })) },
    { key: "semesterId", label: "الفصل الدراسي", options: semesters.map(s => ({ id: s.id, label: `${s.name} (\u2066${s.academicYear}\u2069)` })) },
    { key: "unitId", label: "الوحدة", options: units.map(u => ({ id: u.id, label: u.title })) },
    { key: "lessonId", label: "الدرس", options: lessons.map(l => ({ id: l.id, label: l.title })) },
    { key: "type", label: "النوع", options: [{ id: "MULTIPLE_CHOICE", label: "اختيار من متعدد" }, { id: "TRUE_FALSE", label: "صح أو خطأ" }] },
    { key: "difficulty", label: "الصعوبة", options: [{ id: "EASY", label: "سهل" }, { id: "MEDIUM", label: "متوسط" }, { id: "HARD", label: "صعب" }] },
  ] as const;
  function change(key: string, value: string) {
    const url = new URL(questionListUrl(query, 1), "http://localhost");
    if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
    const hierarchy = ["gradeId", "semesterId", "unitId", "lessonId"];
    const index = hierarchy.indexOf(key);
    if (index >= 0) for (const child of hierarchy.slice(index + 1)) url.searchParams.delete(child);
    startTransition(() => router.push(`${url.pathname}${url.search}`));
  }
  return <section aria-label="تصفية الأسئلة" aria-busy={pending} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {filters.map(filter => <div key={filter.key} className="min-w-0">
      <label htmlFor={`question-${filter.key}`} className="mb-1 block text-sm font-medium">{filter.label}</label>
      <select id={`question-${filter.key}`} value={query[filter.key] ?? ""} disabled={pending}
        onChange={event => change(filter.key, event.target.value)}
        className="min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 focus:ring-2 focus:ring-[var(--najoom-navy)]">
        <option value="">الكل</option>
        {query[filter.key] && !filter.options.some(option => option.id === query[filter.key])
          ? <option value={query[filter.key]}>اختيار غير متاح</option> : null}
        {filter.options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    </div>)}
    {pending ? <p role="status" className="text-sm text-slate-600">جارٍ تحميل النتائج…</p> : null}
  </section>;
}
