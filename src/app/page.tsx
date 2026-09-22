import Image from "next/image";
export default function Home() {
  return (
    <main className="min-h-screen bg-background">
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

      <section className="mx-auto grid min-h-[calc(100vh-77px)] max-w-6xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-2">
        <div>
          <p className="mb-4 font-semibold text-najoom-teal">
            تعلّم • استكشف • تقدّم
          </p>

          <h1 className="max-w-2xl text-4xl font-bold leading-tight text-najoom-navy sm:text-5xl">
            رحلة علمية تساعد كل طالبة على الوصول إلى نجمتها
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
            منصة تعليمية للعلوم تدعم طالبات الصفين الخامس والسادس في التعلّم
            والممارسة ومتابعة التقدم بطريقة واضحة ومحفزة.
          </p>

          <div className="mt-8 rounded-2xl border border-border bg-surface p-5">
           <p className="mt-2 font-semibold text-najoom-navy">
  المعلمة نوال الشوابكة
</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              بيئة تعليمية عربية مصممة لدعم التعلم، إتقان المفاهيم، ومتابعة
              التطور في مادة العلوم.
            </p>
          </div>
        </div>

       <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-[2rem] border border-border bg-white shadow-lg">
  <Image
    src="/brand/najoom-brand-main.png"
    alt="الهوية البصرية لمنصة نجوم التعليمية للعلوم"
    width={1536}
    height={1536}
    priority
    className="h-auto w-full"
  />
</div>
      </section>
    </main>
  );
}
