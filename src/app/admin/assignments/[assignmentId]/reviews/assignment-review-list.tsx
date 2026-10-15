"use client";

import { useState } from "react";
import type { AssignmentReviewData } from "@/lib/assignments/assignment-review-service";

export function AssignmentReviewList({ assignmentId, initialStudents }: {
  assignmentId: string;
  initialStudents: AssignmentReviewData["students"];
}) {
  const [students, setStudents] = useState(initialStudents);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(studentId: string, score: 0 | 1) {
    if (savingId) return;
    setSavingId(studentId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/assignments/${assignmentId}/reviews/${studentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score }),
      });
      const payload = await response.json() as { success: boolean; message?: string; grade?: { score: 0 | 1; gradedAt: string } };
      if (!response.ok || !payload.grade) throw new Error(payload.message || "تعذر حفظ التقييم.");
      setStudents(current => current.map(student => student.id === studentId
        ? { ...student, score: payload.grade!.score, gradedAt: new Date(payload.grade!.gradedAt) }
        : student));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر حفظ التقييم.");
    } finally {
      setSavingId(null);
    }
  }

  if (students.length === 0) return <p className="rounded-2xl bg-white p-6 text-slate-600">لا توجد طالبات نشطات في صف هذا الواجب.</p>;

  return <div className="space-y-3">
    {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    <ul className="space-y-3">
      {students.map(student => <li key={student.id} className="min-w-0 rounded-2xl bg-white p-4 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h2 className="break-words font-semibold">{student.fullName}</h2>
          <p className="mt-1 text-sm text-slate-600">الشعبة: {student.sectionName}</p>
          <p className="mt-1 text-sm font-medium" aria-live="polite">{student.score === null ? "غير مقيّم" : `${student.score} نقطة`}</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 sm:mt-0" aria-label={`تقييم ${student.fullName}`}>
          <button type="button" disabled={savingId !== null} aria-pressed={student.score === 1} onClick={() => save(student.id, 1)} className="min-h-11 rounded-xl bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-50">مكتمل — 1 نقطة</button>
          <button type="button" disabled={savingId !== null} aria-pressed={student.score === 0} onClick={() => save(student.id, 0)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold disabled:opacity-50">غير مكتمل — 0 نقطة</button>
        </div>
      </li>)}
    </ul>
  </div>;
}
