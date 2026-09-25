"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogout() {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        setIsSubmitting(false);
        return;
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setIsSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isSubmitting}
      className="mt-6 min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--najoom-navy)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isSubmitting ? "جارٍ تسجيل الخروج..." : "تسجيل الخروج"}
    </button>
  );
}
