import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/authorization";
import { createLearningObjective, LessonItemServiceError } from "@/lib/curriculum/curriculum-service";
import { readLessonItemBody, parseLessonItemInput, lessonItemErrorResponse } from "../lesson-item-request";

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await readLessonItemBody(request);
    if (typeof body.lessonId !== "string") throw new LessonItemServiceError("invalid_lesson_id");
    const objective = await createLearningObjective({ lessonId: body.lessonId, ...parseLessonItemInput(body) });
    return NextResponse.json({ success: true, objective }, { status: 201 });
  } catch (error) {
    return lessonItemErrorResponse(error);
  }
}
