import { NextResponse } from "next/server";
import { AuthenticationRequiredError, AuthorizationDeniedError, requireAdmin } from "@/lib/auth/authorization";
import { AssessmentServiceError, closeAssessment, publishAssessment } from "@/lib/assessments/assessment-service";

type Context = { params: Promise<{ assessmentId: string }> };

function response(error: unknown) {
  if (error instanceof AuthenticationRequiredError) return NextResponse.json({ success: false, message: "يجب تسجيل الدخول أولًا." }, { status: 401 });
  if (error instanceof AuthorizationDeniedError) return NextResponse.json({ success: false, message: "ليس لديك صلاحية لإدارة الاختبارات." }, { status: 403 });
  if (error instanceof AssessmentServiceError) {
    const status = error.code === "assessment_not_found" ? 404
      : error.code === "assessment_conflict" || error.code === "assessment_invalid_transition" ? 409 : 400;
    return NextResponse.json({ success: false, message: error.message }, { status });
  }
  console.error("Assessment status operation failed:", error);
  return NextResponse.json({ success: false, message: "تعذر تغيير حالة الاختبار. حاولي مرة أخرى." }, { status: 500 });
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    await requireAdmin();
    let input: unknown;
    try { input = await request.json(); } catch { return NextResponse.json({ success: false, message: "بيانات الطلب ليست JSON صالحًا." }, { status: 400 }); }
    if (!input || typeof input !== "object" || Array.isArray(input)
      || Object.keys(input).length !== 1 || !("status" in input)
      || (input.status !== "PUBLISHED" && input.status !== "CLOSED")) {
      return NextResponse.json({ success: false, message: "حالة الاختبار المطلوبة غير صالحة." }, { status: 400 });
    }
    const { assessmentId } = await params;
    const assessment = input.status === "PUBLISHED" ? await publishAssessment(assessmentId) : await closeAssessment(assessmentId);
    return NextResponse.json({ success: true, assessment }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return response(error); }
}
