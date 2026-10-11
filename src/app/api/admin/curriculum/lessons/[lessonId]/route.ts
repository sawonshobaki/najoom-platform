import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/authorization";
import { updateLesson, LessonServiceError } from "@/lib/curriculum/curriculum-service";
import { readLessonBody, parseLessonInput, lessonErrorResponse } from "../lesson-request";

type RouteContext = { params: Promise<{ lessonId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { lessonId } = await context.params;
    const body = await readLessonBody(request);
    if ("unitId" in body) throw new LessonServiceError("invalid_request_body");
    const lesson = await updateLesson(lessonId, parseLessonInput(body));
    return NextResponse.json({ success: true, lesson });
  } catch (error) {
    return lessonErrorResponse(error);
  }
}
