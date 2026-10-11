import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/authorization";
import { createConcept, LessonItemServiceError } from "@/lib/curriculum/curriculum-service";
import { readLessonItemBody, parseLessonItemInput, lessonItemErrorResponse } from "../lesson-item-request";

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await readLessonItemBody(request);
    if (typeof body.lessonId !== "string") throw new LessonItemServiceError("invalid_lesson_id");
    const concept = await createConcept({ lessonId: body.lessonId, ...parseLessonItemInput(body) });
    return NextResponse.json({ success: true, concept }, { status: 201 });
  } catch (error) {
    return lessonItemErrorResponse(error);
  }
}
