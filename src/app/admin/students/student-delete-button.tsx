"use client";

import {
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

type StudentDeleteButtonProps = {
  studentId: string;
  studentName: string;
};

type DeleteResponse = {
  success: boolean;
  message?: string;
};

export function StudentDeleteButton({
  studentId,
  studentName,
}: StudentDeleteButtonProps) {
  const router = useRouter();

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  async function handleDelete() {
    if (isSubmitting) {
      return;
    }

    const confirmed =
      window.confirm(
        `هل أنتِ متأكدة من حذف الطالبة "${studentName}" نهائيًا؟\n\nلا يمكن التراجع عن هذه العملية.`,
      );

    if (!confirmed) {
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/admin/students/${studentId}`,
        {
          method: "DELETE",
        },
      );

      let body:
        | DeleteResponse
        | null = null;

      try {
        body =
          (await response.json()) as DeleteResponse;
      } catch {
        body = null;
      }

      if (
        !response.ok ||
        !body?.success
      ) {
        setErrorMessage(
          body?.message ??
            "تعذر حذف الطالبة.",
        );

        return;
      }

      router.refresh();
    } catch {
      setErrorMessage(
        "تعذر الاتصال بالمنصة الآن.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isSubmitting}
        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting
          ? "جارٍ الحذف..."
          : "حذف الطالبة"}
      </button>

      {errorMessage ? (
        <p
          role="alert"
          aria-live="polite"
          className="max-w-52 text-xs leading-5 text-red-600"
        >
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}