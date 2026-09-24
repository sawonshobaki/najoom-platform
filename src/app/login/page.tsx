import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "تسجيل الدخول | منصة نجوم",
  description: "تسجيل الدخول إلى منصة نجوم التعليمية",
};

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[var(--najoom-bg)] px-4 py-8 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center">
        <section
          className="w-full rounded-3xl border border-black/5 bg-white p-5 shadow-sm sm:p-7"
          aria-labelledby="login-heading"
        >
          <div className="mb-6 text-center">
            <p className="mb-2 text-sm font-medium text-[var(--najoom-gold)]">
              بالعِلم نرتقي
            </p>

            <h1
              id="login-heading"
              className="text-2xl font-bold text-[var(--najoom-navy)]"
            >
              تسجيل الدخول إلى منصة نجوم
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              أدخلي اسم المستخدم وكلمة المرور للوصول إلى حسابك.
            </p>
          </div>

          <LoginForm />
        </section>
      </div>
    </main>
  );
}
