import Link from "next/link";

import { LogoutButton } from "./logout-button";

export default function AdminHomePage() {
  return (
    <main className="min-h-screen bg-[var(--najoom-bg)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <section className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-medium text-[var(--najoom-gold)]">
            منصة نجوم
          </p>

          <h1 className="mt-2 text-2xl font-bold text-[var(--najoom-navy)] sm:text-3xl">
            مرحبًا بكِ في مساحة المدير
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
            من هنا يمكنك الوصول إلى أدوات
            الإدارة الخاصة بالمنصة.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/admin/students"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--najoom-navy)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--najoom-navy)] focus:ring-offset-2"
            >
              إدارة الطالبات
            </Link>

            <LogoutButton />
          </div>
        </section>
      </div>
    </main>
  );
}