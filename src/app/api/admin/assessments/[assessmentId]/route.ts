import { NextResponse } from "next/server";
import { AuthenticationRequiredError, AuthorizationDeniedError, requireAdmin } from "@/lib/auth/authorization";
import { getAssessment, AssessmentServiceError } from "@/lib/assessments/assessment-service";

type Context = { params: Promise<{ assessmentId: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    await requireAdmin();
    const assessment = await getAssessment((await params).assessmentId);
    return NextResponse.json({ success: true, assessment }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ success: false, message: "يجب تسجيل الدخول أولًا." }, { status: 401 });
    if (error instanceof AuthorizationDeniedError) return NextResponse.json({ success: false, message: "ليس لديك صلاحية لعرض الاختبارات." }, { status: 403 });
    if (error instanceof AssessmentServiceError) return NextResponse.json({ success: false, message: error.message }, { status: 404 });
    console.error("Failed to get assessment:", error);
    return NextResponse.json({ success: false, message: "تعذر تحميل الاختبار. حاولي مرة أخرى." }, { status: 500 });
  }
}
