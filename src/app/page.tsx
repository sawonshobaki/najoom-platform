import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <div>
            <p className="text-xl font-bold text-najoom-navy">منصة نجوم</p>
            <p className="mt-1 text-sm text-muted-foreground">بالعِلم نرتقي</p>
          </div>

          <div
            className="flex h-11 w-11 items-center justify-center rounded-full bg-najoom-gold shadow-sm"
            aria-hidden="true"
          >
            <span className="text-2xl text-najoom-navy">★</span>
          </div>
        </div>
      </header>

      <section className="relative">
        <div
          className="pointer-events-none absolute -right-32 top-10 h-72 w-72 rounded-full border border-najoom-sky/15"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -left-24 bottom-10 h-64 w-64 rounded-full border border-najoom-gold/20"
          aria-hidden="true"
        />

        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-10 sm:px-8 sm:py-14 lg:min-h-[calc(100vh-77px)] lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:py-16">
          {/* النص: يظهر بعد الشخصية على الهاتف */}
          <div className="order-2 lg:order-1">
            <p className="mb-4 font-bold text-najoom-teal">
              تعلّم • استكشف • تقدّم
            </p>

            <h1 className="max-w-2xl text-4xl font-bold leading-[1.35] text-najoom-navy sm:text-5xl">
              رحلة علمية تساعد كل طالبة على الوصول إلى نجمتها
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
              تجربة تعليمية عربية لمادة العلوم، مصممة لطالبات الصفين الخامس
              والسادس لتدعم الفهم والممارسة ومتابعة التقدم.
            </p>

            <div className="mt-8 max-w-xl rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <p className="font-bold text-najoom-navy">
                مدرسة أروى بنت عبد المطلب الأساسية
              </p>

              <p className="mt-2 font-semibold text-najoom-teal">
                المعلمة نوال الشوابكة
              </p>

              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                بيئة تعليمية تجمع بين الاستكشاف العلمي، إتقان المفاهيم،
                ومتابعة التطور في رحلة واضحة ومحفزة.
              </p>
            </div>
          </div>

          {/* الهوية: تظهر أولًا على الهاتف */}
          <div className="relative order-1 mx-auto w-full max-w-sm lg:order-2 lg:max-w-md">
            <div
              className="absolute -inset-4 -z-10 rounded-[2.5rem] bg-najoom-sky/10"
              aria-hidden="true"
            />

            <div className="overflow-hidden rounded-[2rem] border border-border bg-surface p-2 shadow-lg">
              <Image
                src="/brand/najoom-brand-main.png"
                alt="شخصية وهوية منصة نجوم التعليمية للعلوم"
                width={1536}
                height={1536}
                priority
                sizes="(max-width: 640px) 90vw, (max-width: 1024px) 448px, 448px"
                className="h-auto w-full rounded-[1.5rem]"
              />
            </div>

            <div className="mx-auto mt-4 flex w-fit items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-najoom-navy shadow-sm">
              <span className="text-najoom-gold" aria-hidden="true">
                ★
              </span>
              <span>بالعِلم نرتقي</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}