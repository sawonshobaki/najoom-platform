import { NextResponse } from "next/server";
import { AuthenticationRequiredError, AuthorizationDeniedError, requireAdmin } from "@/lib/auth/authorization";
import { deleteQuestion, getQuestion, updateQuestion, QuestionCreateError, QuestionMutationError } from "@/lib/questions/question-service";
import { QuestionValidationError } from "@/lib/questions/question-validation";

type Context = { params: Promise<{ questionId: string }> };
function errorResponse(error: unknown) {
  if (error instanceof AuthenticationRequiredError) return NextResponse.json({ success: false, message: "يجب تسجيل الدخول أولًا." }, { status: 401 });
  if (error instanceof AuthorizationDeniedError) return NextResponse.json({ success: false, message: "ليس لديك صلاحية لإدارة الأسئلة." }, { status: 403 });
  if (error instanceof QuestionValidationError) return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  if (error instanceof QuestionMutationError) return NextResponse.json({ success: false, message: error.message }, { status: error.code === "question_not_found" ? 404 : 409 });
  if (error instanceof QuestionCreateError) return NextResponse.json({ success: false, message: error.message }, { status: error.code === "objective_lesson_mismatch" ? 400 : 404 });
  console.error("Question operation failed:", error);
  return NextResponse.json({ success: false, message: "تعذر إتمام عملية السؤال. حاولي مرة أخرى." }, { status: 500 });
}
export async function GET(request: Request, { params }: Context) {
  void request;
  try {
    await requireAdmin();
    return NextResponse.json({ success: true, question: await getQuestion((await params).questionId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
export async function PATCH(request: Request, { params }: Context) {
  try {
    await requireAdmin();
    let input: unknown;
    try { input = await request.json(); } catch { throw new QuestionValidationError("input", "بيانات الطلب ليست JSON صالحًا."); }
    return NextResponse.json({ success: true, question: await updateQuestion((await params).questionId, input) });
  } catch (error) { return errorResponse(error); }
}
export async function DELETE(request: Request, { params }: Context) {
  void request;
  try {
    await requireAdmin();
    await deleteQuestion((await params).questionId);
    return NextResponse.json({ success: true, message: "تم حذف السؤال." });
  } catch (error) { return errorResponse(error); }
}
