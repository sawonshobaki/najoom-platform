import { NextResponse } from "next/server";
import { submitAssessmentAttempt } from "@/lib/assessments/attempt-service";
import { assessmentStudentErrorResponse } from "@/app/api/student/assessment-error-response";

type Context = { params: Promise<{ attemptId: string }> };

export async function POST(_request: Request, { params }: Context) {
  try {
    const result = await submitAssessmentAttempt((await params).attemptId);
    return NextResponse.json({ success: true, result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return assessmentStudentErrorResponse(error); }
}
