import Link from "next/link";

import {
  listStudents,
} from "@/lib/students/student-service";

import {
  StudentActiveButton,
} from "./student-active-button";

import {
  StudentDeleteButton,
} from "./student-delete-button";

import {
  StudentSectionRemoveButton,
} from "./student-section-remove-button";

type AdminStudentsPageProps = {
  searchParams: Promise<{
    search?: string;
    status?: string;
    page?: string;
  }>;
};

const PAGE_SIZE = 20;

function parsePage(
  value: string | undefined,
): number {
  if (!value) {
    return 1;
  }

  const page = Number(value);

  if (
    !Number.isInteger(page) ||
    page < 1
  ) {
    return 1;
  }

  return page;
}

function parseActiveState(
  value: string | undefined,
): boolean | undefined {
  if (value === "active") {
    return true;
  }

  if (value === "inactive") {
    return false;
  }

  return undefined;
}

function buildStudentsUrl(input: {
  search?: string;
  status?: string;
  page?: number;
}) {
  const params =
    new URLSearchParams();

  if (input.search) {
    params.set(
      "search",
      input.search,
    );
  }

  if (
    input.status === "active" ||
    input.status === "inactive"
  ) {
    params.set(
      "status",
      input.status,
    );
  }

  if (
    input.page &&
    input.page > 1
  ) {
    params.set(
      "page",
      String(input.page),
    );
  }

  const query =
    params.toString();

  return query
    ? `/admin/students?${query}`
    : "/admin/students";
}

export default async function AdminStudentsPage({
  searchParams,
}: AdminStudentsPageProps) {
  const params =
    await searchParams;

  const search =
    params.search?.trim() ?? "";

  const status =
    params.status ?? "";

  const requestedPage =
    parsePage(params.page);

  const isActive =
    parseActiveState(status);

  const result =
    await listStudents({
      search:
        search || undefined,
      isActive,
      page: requestedPage,
      pageSize: PAGE_SIZE,
    });

  const {
    students,
    pagination,
  } = result;

  const currentPage =
    pagination.totalPages > 0
      ? Math.min(
          pagination.page,
          pagination.totalPages,
        )
      : 1;

  const hasPreviousPage =
    currentPage > 1;

  const hasNextPage =
    pagination.totalPages > 0 &&
    currentPage <
      pagination.totalPages;

  return (
    <main className="min-h-screen bg-[var(--najoom-bg)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--najoom-gold)]">
              منصة نجوم
            </p>

            <h1 className="mt-1 text-2xl font-bold text-[var(--najoom-navy)] sm:text-3xl">
              إدارة الطالبات
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              عرض الطالبات والبحث عنهن
              ومتابعة حالة الحساب
              والشعبة الحالية.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/admin/students/new"
              className="inline-flex items-center justify-center rounded-xl bg-[var(--najoom-navy)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              إضافة طالبة جديدة
            </Link>

            <Link
              href="/admin"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              العودة إلى لوحة الإدارة
            </Link>
          </div>
        </div>

        <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm sm:p-6">
          <form
            action="/admin/students"
            method="get"
            className="grid gap-4 md:grid-cols-[1fr_220px_auto]"
          >
            <div>
              <label
                htmlFor="search"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                البحث
              </label>

              <input
                id="search"
                name="search"
                type="search"
                defaultValue={search}
                maxLength={100}
                placeholder="الاسم، رقم الطالبة، أو اسم المستخدم"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--najoom-gold)]"
              />
            </div>

            <div>
              <label
                htmlFor="status"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                حالة الحساب
              </label>

              <select
                id="status"
                name="status"
                defaultValue={status}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[var(--najoom-gold)]"
              >
                <option value="">
                  جميع الطالبات
                </option>

                <option value="active">
                  الحسابات المفعلة
                </option>

                <option value="inactive">
                  الحسابات المعطلة
                </option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full rounded-xl bg-[var(--najoom-navy)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 md:w-auto"
              >
                تطبيق
              </button>
            </div>
          </form>

          {(search || status) && (
            <div className="mt-4">
              <Link
                href="/admin/students"
                className="text-sm font-medium text-slate-500 underline underline-offset-4 hover:text-slate-700"
              >
                مسح البحث والتصفية
              </Link>
            </div>
          )}
        </section>

        <section className="mt-6 overflow-hidden rounded-3xl border border-black/5 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="font-bold text-[var(--najoom-navy)]">
                قائمة الطالبات
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                العدد الإجمالي:{" "}
                {pagination.totalCount}
              </p>
            </div>

            {pagination.totalPages >
              0 && (
              <p className="text-sm text-slate-500">
                الصفحة{" "}
                {currentPage} من{" "}
                {pagination.totalPages}
              </p>
            )}
          </div>

          {students.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div
                className="text-4xl"
                aria-hidden="true"
              >
                🔎
              </div>

              <h3 className="mt-4 font-bold text-[var(--najoom-navy)]">
                لا توجد طالبات مطابقة
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                يمكنك إضافة أول طالبة
                من الزر الموجود أعلى
                الصفحة.
              </p>
            </div>
          ) : (
            <>
              {/* نسخة سطح المكتب */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-right">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                    <tr>
                      <th className="px-6 py-4">
                        الطالبة
                      </th>

                      <th className="px-6 py-4">
                        رقم الطالبة
                      </th>

                      <th className="px-6 py-4">
                        اسم المستخدم
                      </th>

                      <th className="px-6 py-4">
                        الصف
                      </th>

                      <th className="px-6 py-4">
                        الشعبة
                      </th>

                      <th className="px-6 py-4">
                        الحالة
                      </th>

                      <th className="px-6 py-4">
                        الإجراءات
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {students.map(
                      (student) => {
                        const accountIsActive =
                          student.isActive &&
                          student.user
                            .isActive;

                        return (
                          <tr
                            key={
                              student.id
                            }
                            className="text-sm text-slate-700"
                          >
                            <td className="px-6 py-4 font-semibold text-[var(--najoom-navy)]">
                              {
                                student.fullName
                              }
                            </td>

                            <td className="px-6 py-4">
                              {
                                student.studentCode
                              }
                            </td>

                            <td className="px-6 py-4">
                              {
                                student.user
                                  .username
                              }
                            </td>

                            <td className="px-6 py-4">
                              {student
                                .currentSection
                                ?.grade
                                .name ??
                                "—"}
                            </td>

                            <td className="px-6 py-4">
                              {student
                                .currentSection
                                ?.name ??
                                "غير محددة"}
                            </td>

                            <td className="px-6 py-4">
                              <StudentStatusBadge
                                isActive={
                                  accountIsActive
                                }
                              />
                            </td>

                            <td className="px-6 py-4">
                              <div className="flex flex-col items-start gap-2">
                                <StudentActiveButton
                                  studentId={
                                    student.id
                                  }
                                  isActive={
                                    accountIsActive
                                  }
                                />

                                {student.currentSection ? (
                                  <StudentSectionRemoveButton
                                    studentId={
                                      student.id
                                    }
                                    sectionName={
                                      student
                                        .currentSection
                                        .name
                                    }
                                  />
                                ) : null}

                                <StudentDeleteButton
                                  studentId={
                                    student.id
                                  }
                                  studentName={
                                    student.fullName
                                  }
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>

              {/* نسخة الهاتف */}
              <div className="divide-y divide-slate-100 md:hidden">
                {students.map(
                  (student) => {
                    const accountIsActive =
                      student.isActive &&
                      student.user
                        .isActive;

                    return (
                      <article
                        key={student.id}
                        className="p-5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-bold text-[var(--najoom-navy)]">
                              {
                                student.fullName
                              }
                            </h3>

                            <p className="mt-1 text-xs text-slate-500">
                              {
                                student.studentCode
                              }
                            </p>
                          </div>

                          <StudentStatusBadge
                            isActive={
                              accountIsActive
                            }
                          />
                        </div>

                        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <dt className="text-xs text-slate-400">
                              اسم المستخدم
                            </dt>

                            <dd className="mt-1 text-slate-700">
                              {
                                student.user
                                  .username
                              }
                            </dd>
                          </div>

                          <div>
                            <dt className="text-xs text-slate-400">
                              الصف
                            </dt>

                            <dd className="mt-1 text-slate-700">
                              {student
                                .currentSection
                                ?.grade
                                .name ??
                                "—"}
                            </dd>
                          </div>

                          <div>
                            <dt className="text-xs text-slate-400">
                              الشعبة
                            </dt>

                            <dd className="mt-1 text-slate-700">
                              {student
                                .currentSection
                                ?.name ??
                                "غير محددة"}
                            </dd>
                          </div>
                        </dl>

                        <div className="mt-4 border-t border-slate-100 pt-4">
                          <div className="flex flex-wrap gap-2">
                            <StudentActiveButton
                              studentId={
                                student.id
                              }
                              isActive={
                                accountIsActive
                              }
                            />

                            {student.currentSection ? (
                              <StudentSectionRemoveButton
                                studentId={
                                  student.id
                                }
                                sectionName={
                                  student
                                    .currentSection
                                    .name
                                }
                              />
                            ) : null}

                            <StudentDeleteButton
                              studentId={
                                student.id
                              }
                              studentName={
                                student.fullName
                              }
                            />
                          </div>
                        </div>
                      </article>
                    );
                  },
                )}
              </div>
            </>
          )}

          {pagination.totalPages >
            1 && (
            <div className="flex items-center justify-between gap-4 border-t border-slate-100 px-5 py-4 sm:px-6">
              {hasPreviousPage ? (
                <Link
                  href={buildStudentsUrl({
                    search,
                    status,
                    page:
                      currentPage -
                      1,
                  })}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  الصفحة السابقة
                </Link>
              ) : (
                <span className="rounded-xl border border-slate-100 px-4 py-2 text-sm text-slate-300">
                  الصفحة السابقة
                </span>
              )}

              <span className="text-sm text-slate-500">
                {currentPage} /{" "}
                {pagination.totalPages}
              </span>

              {hasNextPage ? (
                <Link
                  href={buildStudentsUrl({
                    search,
                    status,
                    page:
                      currentPage +
                      1,
                  })}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  الصفحة التالية
                </Link>
              ) : (
                <span className="rounded-xl border border-slate-100 px-4 py-2 text-sm text-slate-300">
                  الصفحة التالية
                </span>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StudentStatusBadge({
  isActive,
}: {
  isActive: boolean;
}) {
  if (isActive) {
    return (
      <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
        مفعّل
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
      معطّل
    </span>
  );
}