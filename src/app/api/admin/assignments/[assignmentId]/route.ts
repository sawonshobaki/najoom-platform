import { NextResponse } from "next/server";
import { AuthenticationRequiredError, AuthorizationDeniedError, requireAdmin } from "@/lib/auth/authorization";
import { AssignmentServiceError, getAssignment } from "@/lib/assignments/assignment-service";

type Context = { params: Promise<{ assignmentId: string }> };
export async function GET(_request: Request, { params }: Context) {
  try {
    await requireAdmin();
    return NextResponse.json({ success: true, assignment: await getAssignment((await params).assignmentId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ success: false, message: "يجب تسجيل الدخول أولًا." }, { status: 401 });
    if (error instanceof AuthorizationDeniedError) return NextResponse.json({ success: false, message: "ليس لديك صلاحية لإدارة الواجبات." }, { status: 403 });
    if (error instanceof AssignmentServiceError) return NextResponse.json({ success: false, message: error.message }, { status: 404 });
    console.error("Assignment read failed:", error);
    return NextResponse.json({ success: false, message: "تعذر تحميل الواجب. حاولي مرة أخرى." }, { status: 500 });
  }
}
