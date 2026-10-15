import { NextResponse } from "next/server";
import { AuthenticationRequiredError, AuthorizationDeniedError, requireAdmin } from "@/lib/auth/authorization";
import { AssessmentServiceError } from "@/lib/assessments/assessment-service";
import { getAssessmentResults } from "@/lib/assessments/assessment-results-service";

type Context = { params: Promise<{ assessmentId: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    await requireAdmin();
    const results = await getAssessmentResults((await params).assessmentId);
    return NextResponse.json({ success: true, results }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ success: false, message: "يجب تسجيل الدخول أولًا." }, { status: 401 });
    if (error instanceof AuthorizationDeniedError) return NextResponse.json({ success: false, message: "ليس لديك صلاحية لعرض النتائج." }, { status: 403 });
    if (error instanceof AssessmentServiceError && error.code === "assessment_not_found") return NextResponse.json({ success: false, message: error.message }, { status: 404 });
    console.error("Assessment results operation failed:", error);
    return NextResponse.json({ success: false, message: "تعذر تحميل نتائج الاختبار. حاولي مرة أخرى." }, { status: 500 });
  }
}
