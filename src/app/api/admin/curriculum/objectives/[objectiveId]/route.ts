import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/authorization";
import { updateLearningObjective, LessonItemServiceError } from "@/lib/curriculum/curriculum-service";
import { readLessonItemBody, parseLessonItemInput, lessonItemErrorResponse } from "../../lesson-item-request";

type RouteContext = { params: Promise<{ objectiveId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { objectiveId } = await context.params;
    const body = await readLessonItemBody(request);
    if ("lessonId" in body) throw new LessonItemServiceError("invalid_request_body");
    const objective = await updateLearningObjective(objectiveId, parseLessonItemInput(body));
    return NextResponse.json({ success: true, objective });
  } catch (error) {
    return lessonItemErrorResponse(error);
  }
}
