"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Skill = { id: string; name: string };
type ObjectiveSkillsProps = { objectiveId: string; skills: Skill[]; linkedSkills: { skill: Skill }[] };

export function ObjectiveSkills({ objectiveId, skills, linkedSkills }: ObjectiveSkillsProps) {
  const router = useRouter();
  const selectId = useId();
  const [skillId, setSkillId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const linkedIds = new Set(linkedSkills.map(({ skill }) => skill.id));
  const availableSkills = skills.filter((skill) => !linkedIds.has(skill.id));

  async function saveLink(id: string, method: "POST" | "DELETE") {
    if (isSubmitting) return;
    setErrorMessage("");
    setSuccessMessage("");
    if (!id) { setErrorMessage("اختاري مهارة لربطها بالهدف التعليمي."); return; }
    setIsSubmitting(true);
    try {
      const endpoint = `/api/admin/curriculum/skills/objectives/${encodeURIComponent(objectiveId)}`;
      const response = await fetch(method === "DELETE" ? `${endpoint}/${encodeURIComponent(id)}` : endpoint, {
        method,
        ...(method === "POST" ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ skillId: id }) } : {}),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || body === null || typeof body !== "object" || !("success" in body) || body.success !== true) {
        setErrorMessage(body !== null && typeof body === "object" && "message" in body && typeof body.message === "string"
          ? body.message : "تعذر حفظ ربط المهارة.");
        return;
      }
      if (method === "POST") setSkillId("");
      setSuccessMessage(method === "POST" ? "تم ربط المهارة بالهدف التعليمي." : "تمت إزالة ربط المهارة بالهدف التعليمي.");
      router.refresh();
    } catch {
      setErrorMessage("تعذر الاتصال بالمنصة الآن. حاولي مرة أخرى.");
    } finally { setIsSubmitting(false); }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveLink(skillId, "POST");
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-200 p-3">
      <p className="font-semibold text-[var(--najoom-navy)]">المهارات المرتبطة</p>
      {linkedSkills.length === 0 ? <p className="mt-2 text-slate-500">لا توجد مهارات مرتبطة بهذا الهدف التعليمي.</p> : (
        <ul className="mt-2 space-y-2">
          {linkedSkills.map(({ skill }) => (
            <li key={skill.id} className="flex flex-wrap items-center gap-2">
              <span className="break-words">{skill.name}</span>
              <button type="button" disabled={isSubmitting} onClick={() => void saveLink(skill.id, "DELETE")}
                aria-label={`إزالة ربط المهارة: ${skill.name}`}
                className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-red-600 disabled:cursor-not-allowed disabled:opacity-60">
                إزالة الربط
              </button>
            </li>
          ))}
        </ul>
      )}
      {availableSkills.length > 0 ? (
        <form onSubmit={handleSubmit} noValidate className="mt-3 space-y-2">
          <label htmlFor={selectId} className="font-medium text-slate-700">اختيار مهارة موجودة</label>
          <select id={selectId} value={skillId} onChange={(event) => setSkillId(event.target.value)} disabled={isSubmitting}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:border-[var(--najoom-gold)]">
            <option value="">اختاري مهارة</option>
            {availableSkills.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}
          </select>
          <button type="submit" disabled={isSubmitting} className="rounded-xl bg-[var(--najoom-navy)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
            {isSubmitting ? "جارٍ الحفظ..." : "ربط المهارة"}
          </button>
        </form>
      ) : <p className="mt-3 text-slate-500">{skills.length === 0 ? "أضيفي المهارات أولًا من قسم إدارة المهارات." : "جميع المهارات الحالية مرتبطة بهذا الهدف."}</p>}
      {errorMessage ? <p role="alert" className="mt-2 text-red-600">{errorMessage}</p> : null}
      {successMessage ? <p role="status" className="mt-2 text-emerald-700">{successMessage}</p> : null}
    </div>
  );
}
