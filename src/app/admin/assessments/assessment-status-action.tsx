"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AssessmentStatusAction({ assessmentId, target }: { assessmentId: string; target: "PUBLISHED" | "CLOSED" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const publish = target === "PUBLISHED";
  const label = publish ? "نشر الاختبار" : "إغلاق الاختبار";

  async function update() {
    if (pending || !window.confirm(publish ? "هل تريدين نشر الاختبار وإتاحته للطالبات؟" : "هل تريدين إغلاق الاختبار ومنع المحاولات الجديدة؟")) return;
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/admin/assessments/${encodeURIComponent(assessmentId)}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: target }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || !body || typeof body !== "object" || !("success" in body) || body.success !== true) {
        setError(body && typeof body === "object" && "message" in body && typeof body.message === "string" ? body.message : "تعذر تغيير حالة الاختبار.");
        return;
      }
      router.refresh();
    } catch { setError("تعذر الاتصال بالمنصة. حاولي مرة أخرى."); }
    finally { setPending(false); }
  }

  return <div className="min-w-0">
    <button type="button" onClick={update} disabled={pending} className="min-h-11 rounded-xl border border-[var(--najoom-navy)] px-4 py-2 font-semibold disabled:opacity-50 focus:ring-2 focus:ring-[var(--najoom-gold)]">
      {pending ? "جارٍ التنفيذ…" : label}
    </button>
    {error ? <p role="alert" className="mt-2 break-words text-sm text-red-700">{error}</p> : null}
  </div>;
}
