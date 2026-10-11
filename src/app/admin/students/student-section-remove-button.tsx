"use client";

import {
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

type StudentSectionRemoveButtonProps = {
  studentId: string;
  sectionName: string;
};

type RemoveSectionResponse = {
  success: boolean;
  message?: string;
};

export function StudentSectionRemoveButton({
  studentId,
  sectionName,
}: StudentSectionRemoveButtonProps) {
  const router = useRouter();

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  async function handleRemove() {
    if (isSubmitting) {
      return;
    }

    const confirmed =
      window.confirm(
        `هل تريدين إزالة الطالبة من الشعبة ${sectionName}؟\n\nلن يتم حذف حساب الطالبة أو نتائجها.`,
      );

    if (!confirmed) {
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/admin/students/${studentId}/section`,
        {
          method: "DELETE",
        },
      );

      let body:
        | RemoveSectionResponse
        | null = null;

      try {
        body =
          (await response.json()) as RemoveSectionResponse;
      } catch {
        body = null;
      }

      if (
        !response.ok ||
        !body?.success
      ) {
        setErrorMessage(
          body?.message ??
            "تعذر إزالة الطالبة من الشعبة.",
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
        onClick={handleRemove}
        disabled={isSubmitting}
        className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting
          ? "جارٍ الإزالة..."
          : "إزالة من الشعبة"}
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