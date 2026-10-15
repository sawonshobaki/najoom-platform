import { NextResponse } from "next/server";
import { AuthenticationRequiredError, AuthorizationDeniedError, requireAdmin } from "@/lib/auth/authorization";
import { AssignmentServiceError, createAssignment, listAssignments } from "@/lib/assignments/assignment-service";
import { AssignmentValidationError } from "@/lib/assignments/assignment-validation";

function errorResponse(error: unknown) {
  if (error instanceof AuthenticationRequiredError) return NextResponse.json({ success: false, message: "يجب تسجيل الدخول أولًا." }, { status: 401 });
  if (error instanceof AuthorizationDeniedError) return NextResponse.json({ success: false, message: "ليس لديك صلاحية لإدارة الواجبات." }, { status: 403 });
  if (error instanceof AssignmentValidationError) return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  if (error instanceof AssignmentServiceError) return NextResponse.json({ success: false, message: error.message }, { status: error.code === "lesson_not_found" || error.code === "assignment_not_found" ? 404 : 400 });
  console.error("Assignment operation failed:", error);
  return NextResponse.json({ success: false, message: "تعذر إتمام عملية الواجب. حاولي مرة أخرى." }, { status: 500 });
}

export async function GET() {
  try { await requireAdmin(); return NextResponse.json({ success: true, assignments: await listAssignments() }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    let input: unknown;
    try { input = await request.json(); } catch { throw new AssignmentValidationError("input", "بيانات الطلب ليست JSON صالحًا."); }
    const assignment = await createAssignment(input);
    return NextResponse.json({ success: true, assignment }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
