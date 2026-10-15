import { NextResponse } from "next/server";
import { AuthenticationRequiredError, AuthorizationDeniedError } from "@/lib/auth/authorization";
import { AttemptServiceError } from "@/lib/assessments/attempt-service";
import { AttemptValidationError } from "@/lib/assessments/attempt-validation";

export function assessmentStudentErrorResponse(error: unknown) {
  if (error instanceof AuthenticationRequiredError) return NextResponse.json({ success: false, message: "يجب تسجيل الدخول أولًا." }, { status: 401 });
  if (error instanceof AuthorizationDeniedError) return NextResponse.json({ success: false, message: "هذه العملية متاحة للطالبات فقط." }, { status: 403 });
  if (error instanceof AttemptValidationError) return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  if (error instanceof AttemptServiceError) {
    const status = ["assessment_not_found", "attempt_not_found", "attempt_question_not_found"].includes(error.code) ? 404
      : ["attempt_exists", "attempt_submitted", "attempt_conflict"].includes(error.code) ? 409 : 400;
    return NextResponse.json({ success: false, message: error.message }, { status });
  }
  console.error("Student assessment operation failed:", error);
  return NextResponse.json({ success: false, message: "تعذر إتمام عملية الاختبار. حاولي مرة أخرى." }, { status: 500 });
}
