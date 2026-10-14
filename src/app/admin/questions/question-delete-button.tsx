"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function QuestionDeleteButton({ questionId, isUsed }: { questionId: string; isUsed: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);
  async function remove() {
    if (isUsed || busy.current || !window.confirm("هل أنتِ متأكدة من حذف هذا السؤال؟ لا يمكن التراجع عن الحذف.")) return;
    busy.current = true; setPending(true); setMessage(""); setFailed(false);
    try {
      const response = await fetch(`/api/admin/questions/${encodeURIComponent(questionId)}`, { method: "DELETE" });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || !body || typeof body !== "object" || !("success" in body) || body.success !== true) {
        setFailed(true); setMessage(body && typeof body === "object" && "message" in body && typeof body.message === "string" ? body.message : "تعذر حذف السؤال."); return;
      }
      setMessage("تم حذف السؤال."); router.refresh();
    } catch { setFailed(true); setMessage("تعذر الاتصال بالمنصة. حاولي مرة أخرى."); }
    finally { busy.current = false; setPending(false); }
  }
  return <div className="min-w-0 space-y-2">
    <button type="button" onClick={remove} disabled={isUsed || pending} title={isUsed ? "السؤال مستخدم في تقييم" : undefined}
      className="min-h-11 rounded-xl border border-red-200 px-4 py-2 text-red-700 disabled:opacity-50 focus:ring-2 focus:ring-red-400">{pending ? "جارٍ الحذف…" : "حذف"}</button>
    {message ? <p role={failed ? "alert" : "status"} className="break-words text-sm">{message}</p> : null}
  </div>;
}
