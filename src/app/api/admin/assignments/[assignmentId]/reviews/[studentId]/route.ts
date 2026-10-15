import { NextResponse } from "next/server";
import { AuthenticationRequiredError, AuthorizationDeniedError, requireAdmin } from "@/lib/auth/authorization";
import { AssignmentReviewServiceError, setAssignmentGrade } from "@/lib/assignments/assignment-review-service";
import { AssignmentReviewValidationError, validateAssignmentScore } from "@/lib/assignments/assignment-review-validation";

export async function PUT(request: Request, { params }: { params: Promise<{ assignmentId: string; studentId: string }> }) {
  try {
    await requireAdmin();
    let body: unknown;
    try { body = await request.json(); } catch { throw new AssignmentReviewValidationError("بيانات الطلب ليست JSON صالحًا."); }
    const score = validateAssignmentScore(body);
    const { assignmentId, studentId } = await params;
    const grade = await setAssignmentGrade({ assignmentId, studentId, score });
    return NextResponse.json({ success: true, grade }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ success: false, message: "يجب تسجيل الدخول أولًا." }, { status: 401 });
    if (error instanceof AuthorizationDeniedError) return NextResponse.json({ success: false, message: "ليس لديك صلاحية لتقييم الواجبات." }, { status: 403 });
    if (error instanceof AssignmentReviewValidationError) return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    if (error instanceof AssignmentReviewServiceError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.code === "student_not_eligible" ? 409 : 404 });
    }
    console.error("Assignment grade update failed:", error);
    return NextResponse.json({ success: false, message: "تعذر حفظ تقييم الواجب." }, { status: 500 });
  }
}
