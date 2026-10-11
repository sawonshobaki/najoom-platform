import Link from "next/link";

import { listCurriculum } from "@/lib/curriculum/curriculum-service";
import { SemesterForm } from "./semester-form";
import { UnitForm } from "./unit-form";
import { LessonForm } from "./lesson-form";
import { LessonItems } from "./lesson-items";

export default async function AdminCurriculumPage() {
  const grades = await listCurriculum();

  return (
    <main dir="rtl" className="min-h-screen bg-[var(--najoom-bg)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--najoom-gold)]">
              منصة نجوم
            </p>
            <h1 className="mt-1 text-2xl font-bold text-[var(--najoom-navy)] sm:text-3xl">
              إدارة المنهج
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              عرض الصفوف والفصول الدراسية والوحدات والدروس الحالية.
            </p>
          </div>
          <Link
            href="/admin"
            className="inline-flex w-fit items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            العودة إلى لوحة الإدارة
          </Link>
        </div>

        {grades.length === 0 ? (
          <div className="rounded-3xl border border-black/5 bg-white p-6 text-sm leading-6 text-slate-600 shadow-sm">
            لا يوجد منهج لعرضه حاليًا؛ لم تُسجّل أي صفوف بعد.
          </div>
        ) : (
          <div className="space-y-6">
            {grades.map((grade) => (
              <section
                key={grade.id}
                aria-labelledby={`grade-${grade.id}`}
                className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm sm:p-6"
              >
                <h2 id={`grade-${grade.id}`} className="text-xl font-bold text-[var(--najoom-navy)]">
                  {grade.name}
                </h2>

                <details className="mt-4 rounded-xl border border-slate-200 p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-[var(--najoom-navy)]">
                    إضافة فصل دراسي
                  </summary>
                  <SemesterForm gradeId={grade.id} />
                </details>

                {grade.semesters.length === 0 ? (
                  <p className="mt-4 text-sm leading-6 text-slate-500">
                    لم يُضف منهج لهذا الصف بعد؛ لا توجد فصول دراسية مسجلة.
                  </p>
                ) : (
                  <div className="mt-4 space-y-5">
                    {grade.semesters.map((semester) => (
                      <section key={semester.id} className="rounded-2xl border border-slate-200 p-4">
                        <h3 className="font-bold text-[var(--najoom-navy)]">
                          {semester.name}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          السنة الدراسية: {semester.academicYear}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          ترتيب الفصل: {semester.sortOrder}
                        </p>
                        <details className="mt-3 rounded-xl border border-slate-200 p-3">
                          <summary className="cursor-pointer text-sm font-semibold text-[var(--najoom-navy)]">
                            تعديل الفصل الدراسي
                          </summary>
                          <SemesterForm gradeId={grade.id} semester={semester} />
                        </details>

                        <details className="mt-3 rounded-xl border border-slate-200 p-3">
                          <summary className="cursor-pointer text-sm font-semibold text-[var(--najoom-navy)]">
                            إضافة وحدة
                          </summary>
                          <UnitForm semesterId={semester.id} />
                        </details>

                        {semester.units.length === 0 ? (
                          <p className="mt-3 text-sm text-slate-500">
                            لا توجد وحدات مسجلة لهذا الفصل الدراسي.
                          </p>
                        ) : (
                          <div className="mt-4 space-y-4">
                            {semester.units.map((unit) => (
                              <section key={unit.id} className="border-s-2 border-[var(--najoom-gold)] ps-4">
                                <h4 className="text-sm font-semibold text-[var(--najoom-navy)]">
                                  الوحدة {unit.sortOrder}: {unit.title}
                                </h4>
                                {unit.description ? (
                                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
                                    {unit.description}
                                  </p>
                                ) : null}
                                <details className="mt-3 rounded-xl border border-slate-200 p-3">
                                  <summary className="cursor-pointer text-sm font-semibold text-[var(--najoom-navy)]">
                                    تعديل الوحدة
                                  </summary>
                                  <UnitForm semesterId={semester.id} unit={unit} />
                                </details>
                                <details className="mt-3 rounded-xl border border-slate-200 p-3">
                                  <summary className="cursor-pointer text-sm font-semibold text-[var(--najoom-navy)]">
                                    إضافة درس
                                  </summary>
                                  <LessonForm unitId={unit.id} />
                                </details>
                                {unit.lessons.length === 0 ? (
                                  <p className="mt-2 text-sm text-slate-500">
                                    لا توجد دروس مسجلة لهذه الوحدة.
                                  </p>
                                ) : (
                                  <ol className="mt-2 space-y-2 text-sm leading-6 text-slate-600">
                                    {unit.lessons.map((lesson) => (
                                      <li key={lesson.id}>
                                        <h5 className="font-semibold text-[var(--najoom-navy)]">
                                          الدرس {lesson.sortOrder}: {lesson.title}
                                        </h5>
                                        {lesson.description ? (
                                          <p className="mt-1 whitespace-pre-wrap break-words">
                                            {lesson.description}
                                          </p>
                                        ) : null}
                                        <details className="mt-2 rounded-xl border border-slate-200 p-3">
                                          <summary className="cursor-pointer font-semibold text-[var(--najoom-navy)]">
                                            تعديل الدرس
                                          </summary>
                                          <LessonForm unitId={unit.id} lesson={lesson} />
                                        </details>
                                        <LessonItems lessonId={lesson.id} concepts={lesson.concepts} learningObjectives={lesson.learningObjectives} />
                                      </li>
                                    ))}
                                  </ol>
                                )}
                              </section>
                            ))}
                          </div>
                        )}
                      </section>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
