import Link from "next/link";

import {
  listActiveGradesAndSections,
} from "@/lib/students/student-service";

import {
  StudentCreateForm,
} from "./student-create-form";

export default async function NewStudentPage() {
  const grades =
    await listActiveGradesAndSections();

  return (
    <main className="min-h-screen bg-[var(--najoom-bg)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--najoom-gold)]">
              منصة نجوم
            </p>

            <h1 className="mt-1 text-2xl font-bold text-[var(--najoom-navy)]">
              إضافة طالبة جديدة
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              أدخلي بيانات الطالبة وحددي
              الصف والشعبة.
            </p>
          </div>

          <Link
            href="/admin/students"
            className="inline-flex w-fit items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            العودة إلى الطالبات
          </Link>
        </div>

        <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm sm:p-7">
          {grades.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-800">
              لا توجد صفوف أو شعب متاحة حاليًا.
            </div>
          ) : (
            <StudentCreateForm
              grades={grades}
            />
          )}
        </section>
      </div>
    </main>
  );
}