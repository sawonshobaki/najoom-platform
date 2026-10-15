import { NextResponse } from "next/server";
import { AuthenticationRequiredError, AuthorizationDeniedError, requireStudent } from "@/lib/auth/authorization";
import { AssignmentServiceError, listStudentAssignments } from "@/lib/assignments/assignment-service";

export async function GET() {
  try {
    await requireStudent();
    return NextResponse.json({ success: true, assignments: await listStudentAssignments() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ success: false, message: "يجب تسجيل الدخول أولًا." }, { status: 401 });
    if (error instanceof AuthorizationDeniedError) return NextResponse.json({ success: false, message: "هذه الصفحة متاحة للطالبات فقط." }, { status: 403 });
    if (error instanceof AssignmentServiceError) return NextResponse.json({ success: false, message: error.message }, { status: 404 });
    console.error("Student assignments read failed:", error);
    return NextResponse.json({ success: false, message: "تعذر تحميل الواجبات. حاولي مرة أخرى." }, { status: 500 });
  }
}
