"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type LoginResponse =
  | {
      success: true;
    }
  | {
      success: false;
      message: string;
    };

export function LoginForm() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const body = (await response.json()) as LoginResponse;

      if (!response.ok || !body.success) {
        setErrorMessage(
          body.success
            ? "تعذر تسجيل الدخول. حاولي مرة أخرى."
            : body.message,
        );

        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setErrorMessage(
        "تعذر الاتصال بالمنصة الآن. حاولي مرة أخرى.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5"
      noValidate
    >
      <div>
        <label
          htmlFor="username"
          className="mb-2 block text-sm font-semibold text-slate-800"
        >
          اسم المستخدم
        </label>

        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          inputMode="text"
          maxLength={100}
          required
          value={username}
          onChange={(event) => {
            setUsername(event.target.value);
          }}
          disabled={isSubmitting}
          className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-[var(--najoom-navy)] focus:ring-2 focus:ring-[var(--najoom-navy)]/10 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-2 block text-sm font-semibold text-slate-800"
        >
          كلمة المرور
        </label>

        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          maxLength={128}
          required
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
          disabled={isSubmitting}
          className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-[var(--najoom-navy)] focus:ring-2 focus:ring-[var(--najoom-navy)]/10 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
      </div>

      {errorMessage ? (
        <p
          role="alert"
          aria-live="polite"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
        >
          {errorMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="min-h-12 w-full rounded-xl bg-[var(--najoom-navy)] px-4 font-semibold text-white transition hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-[var(--najoom-navy)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting
          ? "جارٍ تسجيل الدخول..."
          : "تسجيل الدخول"}
      </button>
    </form>
  );
}
