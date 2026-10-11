import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/authorization";
import { createLessonResource, LessonResourceServiceError } from "@/lib/curriculum/lesson-resource-service";
import { readResourceBody, parseResourceInput, resourceErrorResponse } from "./resource-request";

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await readResourceBody(request);
    if (typeof body.lessonId !== "string") throw new LessonResourceServiceError("invalid_lesson_id");
    const resource = await createLessonResource({ lessonId: body.lessonId, ...parseResourceInput(body) });
    return NextResponse.json({ success: true, resource }, { status: 201 });
  } catch (error) { return resourceErrorResponse(error); }
}
