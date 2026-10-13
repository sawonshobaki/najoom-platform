import { NextResponse } from "next/server";
import { AuthenticationRequiredError, AuthorizationDeniedError, requireAdmin } from "@/lib/auth/authorization";
import { createQuestion, listQuestions, QuestionCreateError } from "@/lib/questions/question-service";
import { QuestionValidationError } from "@/lib/questions/question-validation";
import { parseQuestionQuery, QuestionReadValidationError } from "@/lib/questions/question-read-query";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const query = parseQuestionQuery(new URL(request.url).searchParams);
    const result = await listQuestions(query);
    return NextResponse.json({ success: true, ...result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ success: false, message: "يجب تسجيل الدخول أولًا." }, { status: 401 });
    if (error instanceof AuthorizationDeniedError) return NextResponse.json({ success: false, message: "ليس لديك صلاحية لعرض بنك الأسئلة." }, { status: 403 });
    if (error instanceof QuestionReadValidationError) return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    console.error("Failed to list questions:", error);
    return NextResponse.json({ success: false, message: "تعذر تحميل بنك الأسئلة. حاولي مرة أخرى." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    let input: unknown;
    try { input = await request.json(); }
    catch { throw new QuestionValidationError("input", "بيانات الطلب ليست JSON صالحًا."); }
    const question = await createQuestion(input);
    return NextResponse.json({ success: true, question }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ success: false, message: "يجب تسجيل الدخول أولًا." }, { status: 401 });
    if (error instanceof AuthorizationDeniedError) return NextResponse.json({ success: false, message: "ليس لديك صلاحية لإضافة الأسئلة." }, { status: 403 });
    if (error instanceof QuestionValidationError) return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    if (error instanceof QuestionCreateError) return NextResponse.json({ success: false, message: error.message }, { status: error.code === "objective_lesson_mismatch" ? 400 : 404 });
    console.error("Failed to create question:", error);
    return NextResponse.json({ success: false, message: "تعذر حفظ السؤال. حاولي مرة أخرى." }, { status: 500 });
  }
}
