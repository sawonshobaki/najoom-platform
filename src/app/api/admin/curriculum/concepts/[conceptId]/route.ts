import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/authorization";
import { updateConcept, LessonItemServiceError } from "@/lib/curriculum/curriculum-service";
import { readLessonItemBody, parseLessonItemInput, lessonItemErrorResponse } from "../../lesson-item-request";

type RouteContext = { params: Promise<{ conceptId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { conceptId } = await context.params;
    const body = await readLessonItemBody(request);
    if ("lessonId" in body) throw new LessonItemServiceError("invalid_request_body");
    const concept = await updateConcept(conceptId, parseLessonItemInput(body));
    return NextResponse.json({ success: true, concept });
  } catch (error) {
    return lessonItemErrorResponse(error);
  }
}
