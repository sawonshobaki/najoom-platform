import { NextResponse } from "next/server";
import { startAssessmentAttempt } from "@/lib/assessments/attempt-service";
import { assessmentStudentErrorResponse } from "@/app/api/student/assessment-error-response";

type Context = { params: Promise<{ assessmentId: string }> };

export async function POST(_request: Request, { params }: Context) {
  try {
    const attempt = await startAssessmentAttempt((await params).assessmentId);
    return NextResponse.json({ success: true, attempt }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return assessmentStudentErrorResponse(error); }
}
