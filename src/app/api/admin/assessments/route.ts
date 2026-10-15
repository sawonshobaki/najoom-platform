import { NextResponse } from "next/server";
import { AuthenticationRequiredError, AuthorizationDeniedError, requireAdmin } from "@/lib/auth/authorization";
import { createAssessment, listAssessments, AssessmentServiceError } from "@/lib/assessments/assessment-service";
import { AssessmentValidationError } from "@/lib/assessments/assessment-validation";

function errorResponse(error: unknown) {
  if (error instanceof AuthenticationRequiredError) return NextResponse.json({ success: false, message: "يجب تسجيل الدخول أولًا." }, { status: 401 });
  if (error instanceof AuthorizationDeniedError) return NextResponse.json({ success: false, message: "ليس لديك صلاحية لإدارة الاختبارات." }, { status: 403 });
  if (error instanceof AssessmentValidationError) return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  if (error instanceof AssessmentServiceError) {
    const status = error.code === "lesson_not_found" || error.code === "question_not_found" ? 404 : error.code === "assessment_not_found" ? 404 : 400;
    return NextResponse.json({ success: false, message: error.message }, { status });
  }
  console.error("Assessment operation failed:", error);
  return NextResponse.json({ success: false, message: "تعذر إتمام عملية الاختبار. حاولي مرة أخرى." }, { status: 500 });
}

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({ success: true, assessments: await listAssessments() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    let input: unknown;
    try { input = await request.json(); }
    catch { throw new AssessmentValidationError("input", "بيانات الطلب ليست JSON صالحًا."); }
    const assessment = await createAssessment(input);
    return NextResponse.json({ success: true, assessment }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
