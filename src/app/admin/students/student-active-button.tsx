"use client";

import {
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

type StudentActiveButtonProps = {
  studentId: string;
  isActive: boolean;
};

type UpdateResponse = {
  success: boolean;
  message?: string;
};

export function StudentActiveButton({
  studentId,
  isActive,
}: StudentActiveButtonProps) {
  const router = useRouter();

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  async function handleClick() {
    if (isSubmitting) {
      return;
    }

    const nextState = !isActive;

    const confirmationMessage =
      nextState
        ? "هل تريدين إعادة تفعيل حساب هذه الطالبة؟"
        : "هل تريدين تعطيل حساب هذه الطالبة؟";

    if (
      !window.confirm(
        confirmationMessage,
      )
    ) {
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/admin/students/${studentId}/active`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            isActive:
              nextState,
          }),
        },
      );

      let body:
        | UpdateResponse
        | null = null;

      try {
        body =
          (await response.json()) as UpdateResponse;
      } catch {
        body = null;
      }

      if (
        !response.ok ||
        !body?.success
      ) {
        setErrorMessage(
          body?.message ??
            "تعذر تحديث حالة الطالبة.",
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
        onClick={handleClick}
        disabled={isSubmitting}
        className={
          isActive
            ? "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            : "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        {isSubmitting
          ? "جارٍ التحديث..."
          : isActive
            ? "تعطيل الحساب"
            : "تفعيل الحساب"}
      </button>

      {errorMessage ? (
        <p
          role="alert"
          className="max-w-48 text-xs leading-5 text-red-600"
        >
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}