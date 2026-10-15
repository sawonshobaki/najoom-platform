import { NextResponse } from "next/server";
import { saveAssessmentAnswer } from "@/lib/assessments/attempt-service";
import { AttemptValidationError } from "@/lib/assessments/attempt-validation";
import { assessmentStudentErrorResponse } from "@/app/api/student/assessment-error-response";

type Context = { params: Promise<{ attemptId: string; assessmentQuestionId: string }> };

export async function PUT(request: Request, { params }: Context) {
  try {
    let input: unknown;
    try { input = await request.json(); } catch { throw new AttemptValidationError("بيانات الإجابة ليست JSON صالحًا."); }
    const { attemptId, assessmentQuestionId } = await params;
    const answer = await saveAssessmentAnswer(attemptId, assessmentQuestionId, input);
    return NextResponse.json({ success: true, answer }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return assessmentStudentErrorResponse(error); }
}
