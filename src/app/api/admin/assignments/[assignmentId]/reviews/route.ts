import { NextResponse } from "next/server";
import { AuthenticationRequiredError, AuthorizationDeniedError, requireAdmin } from "@/lib/auth/authorization";
import { AssignmentReviewServiceError, listAssignmentReviews } from "@/lib/assignments/assignment-review-service";

export async function GET(_request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    await requireAdmin();
    const { assignmentId } = await params;
    return NextResponse.json(
      { success: true, ...(await listAssignmentReviews(assignmentId)) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ success: false, message: "يجب تسجيل الدخول أولًا." }, { status: 401 });
    if (error instanceof AuthorizationDeniedError) return NextResponse.json({ success: false, message: "ليس لديك صلاحية لمراجعة الواجبات." }, { status: 403 });
    if (error instanceof AssignmentReviewServiceError) return NextResponse.json({ success: false, message: error.message }, { status: 404 });
    console.error("Assignment reviews read failed:", error);
    return NextResponse.json({ success: false, message: "تعذر تحميل تقييمات الواجب." }, { status: 500 });
  }
}
