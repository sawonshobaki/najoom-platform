export default function StudentHomePage() {
  return (
    <main className="min-h-screen bg-[var(--najoom-bg)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <section className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-medium text-[var(--najoom-gold)]">
            منصة نجوم
          </p>

          <h1 className="mt-2 text-2xl font-bold text-[var(--najoom-navy)] sm:text-3xl">
            مرحبًا بكِ في مساحة الطالبة
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
            هذه الصفحة مؤقتة لاختبار تسجيل الدخول وحماية المسارات.
            سنبني لوحة الطالبة الكاملة في مرحلتها المخصصة لاحقًا.
          </p>
        </section>
      </div>
    </main>
  );
}
