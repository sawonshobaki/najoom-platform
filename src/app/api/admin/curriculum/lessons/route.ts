import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/authorization";
import { createLesson, LessonServiceError } from "@/lib/curriculum/curriculum-service";
import { readLessonBody, parseLessonInput, lessonErrorResponse } from "./lesson-request";

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await readLessonBody(request);
    if (typeof body.unitId !== "string") throw new LessonServiceError("invalid_unit_id");
    const lesson = await createLesson({ unitId: body.unitId, ...parseLessonInput(body) });
    return NextResponse.json({ success: true, lesson }, { status: 201 });
  } catch (error) {
    return lessonErrorResponse(error);
  }
}
