import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/authorization";
import { updateLessonResource, LessonResourceServiceError } from "@/lib/curriculum/lesson-resource-service";
import { readResourceBody, parseResourceInput, resourceErrorResponse } from "../resource-request";

type RouteContext = { params: Promise<{ resourceId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { resourceId } = await context.params;
    const body = await readResourceBody(request);
    if ("lessonId" in body) throw new LessonResourceServiceError("invalid_request_body");
    const resource = await updateLessonResource(resourceId, parseResourceInput(body));
    return NextResponse.json({ success: true, resource });
  } catch (error) { return resourceErrorResponse(error); }
}
