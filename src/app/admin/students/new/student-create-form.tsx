"use client";

import {
  FormEvent,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

type GradeOption = {
  id: string;
  name: string;
  sortOrder: number;
  sections: {
    id: string;
    name: string;
  }[];
};

type StudentCreateFormProps = {
  grades: GradeOption[];
};

type CreateStudentResponse =
  | {
      success: true;
      student: {
        id: string;
        fullName: string;
        studentCode: string;
      };
    }
  | {
      success: false;
      message: string;
    };

export function StudentCreateForm({
  grades,
}: StudentCreateFormProps) {
  const router = useRouter();

  const [fullName, setFullName] =
    useState("");

  const [
    studentCode,
    setStudentCode,
  ] = useState("");

  const [username, setUsername] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [gradeId, setGradeId] =
    useState("");

  const [sectionId, setSectionId] =
    useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const sections = useMemo(() => {
    const selectedGrade =
      grades.find(
        (grade) =>
          grade.id === gradeId,
      );

    return (
      selectedGrade?.sections ??
      []
    );
  }, [gradeId, grades]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage("");

    if (!fullName.trim()) {
      setErrorMessage(
        "يرجى إدخال اسم الطالبة.",
      );

      return;
    }

    if (!studentCode.trim()) {
      setErrorMessage(
        "يرجى إدخال رقم الطالبة.",
      );

      return;
    }

    if (!username.trim()) {
      setErrorMessage(
        "يرجى إدخال اسم المستخدم.",
      );

      return;
    }

    if (password.length < 10) {
      setErrorMessage(
        "يجب أن تتكون كلمة المرور من 10 أحرف على الأقل.",
      );

      return;
    }

    if (!gradeId) {
      setErrorMessage(
        "يرجى اختيار الصف.",
      );

      return;
    }

    if (!sectionId) {
      setErrorMessage(
        "يرجى اختيار الشعبة.",
      );

      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        "/api/admin/students",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            fullName,
            studentCode,
            username,
            password,
            sectionId,
          }),
        },
      );

      let body:
        | CreateStudentResponse
        | null = null;

      try {
        body =
          (await response.json()) as CreateStudentResponse;
      } catch {
        body = null;
      }

      if (
        !response.ok ||
        !body ||
        !body.success
      ) {
        setErrorMessage(
          body &&
            !body.success
            ? body.message
            : "تعذر إنشاء الطالبة. حاولي مرة أخرى.",
        );

        return;
      }

      router.replace(
        "/admin/students",
      );

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
          htmlFor="fullName"
          className="mb-2 block text-sm font-semibold text-slate-800"
        >
          اسم الطالبة
        </label>

        <input
          id="fullName"
          name="fullName"
          type="text"
          value={fullName}
          onChange={(event) =>
            setFullName(
              event.target.value,
            )
          }
          required
          maxLength={150}
          disabled={isSubmitting}
          autoComplete="off"
          className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-[var(--najoom-navy)] focus:ring-2 focus:ring-[var(--najoom-navy)]/10 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
      </div>

      <div>
        <label
          htmlFor="studentCode"
          className="mb-2 block text-sm font-semibold text-slate-800"
        >
          رقم الطالبة
        </label>

        <input
          id="studentCode"
          name="studentCode"
          type="text"
          value={studentCode}
          onChange={(event) =>
            setStudentCode(
              event.target.value,
            )
          }
          required
          maxLength={30}
          disabled={isSubmitting}
          placeholder="مثال: ST-0001"
          autoComplete="off"
          className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-[var(--najoom-navy)] focus:ring-2 focus:ring-[var(--najoom-navy)]/10 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
      </div>

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
          value={username}
          onChange={(event) =>
            setUsername(
              event.target.value,
            )
          }
          required
          maxLength={100}
          autoComplete="off"
          disabled={isSubmitting}
          className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-[var(--najoom-navy)] focus:ring-2 focus:ring-[var(--najoom-navy)]/10 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-2 block text-sm font-semibold text-slate-800"
        >
          كلمة المرور الأولية
        </label>

        <input
          id="password"
          name="password"
          type="password"
          value={password}
          onChange={(event) =>
            setPassword(
              event.target.value,
            )
          }
          required
          minLength={10}
          maxLength={128}
          autoComplete="new-password"
          disabled={isSubmitting}
          className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-[var(--najoom-navy)] focus:ring-2 focus:ring-[var(--najoom-navy)]/10 disabled:cursor-not-allowed disabled:bg-slate-100"
        />

        <p className="mt-2 text-xs leading-5 text-slate-500">
          يجب أن تتكون كلمة المرور من 10
          أحرف على الأقل.
        </p>
      </div>

      <div>
        <label
          htmlFor="grade"
          className="mb-2 block text-sm font-semibold text-slate-800"
        >
          الصف
        </label>

        <select
          id="grade"
          name="grade"
          value={gradeId}
          onChange={(event) => {
            setGradeId(
              event.target.value,
            );

            setSectionId("");
          }}
          required
          disabled={isSubmitting}
          className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-[var(--najoom-navy)] focus:ring-2 focus:ring-[var(--najoom-navy)]/10 disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          <option value="">
            اختاري الصف
          </option>

          {grades.map(
            (grade) => (
              <option
                key={grade.id}
                value={grade.id}
              >
                {grade.name}
              </option>
            ),
          )}
        </select>
      </div>

      <div>
        <label
          htmlFor="section"
          className="mb-2 block text-sm font-semibold text-slate-800"
        >
          الشعبة
        </label>

        <select
          id="section"
          name="section"
          value={sectionId}
          onChange={(event) =>
            setSectionId(
              event.target.value,
            )
          }
          required
          disabled={
            isSubmitting ||
            !gradeId
          }
          className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-[var(--najoom-navy)] focus:ring-2 focus:ring-[var(--najoom-navy)]/10 disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          <option value="">
            اختاري الشعبة
          </option>

          {sections.map(
            (section) => (
              <option
                key={section.id}
                value={section.id}
              >
                {section.name}
              </option>
            ),
          )}
        </select>
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
        className="min-h-12 w-full rounded-xl bg-[var(--najoom-navy)] px-5 font-semibold text-white transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--najoom-navy)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting
          ? "جارٍ إنشاء الطالبة..."
          : "إضافة الطالبة"}
      </button>
    </form>
  );
}
