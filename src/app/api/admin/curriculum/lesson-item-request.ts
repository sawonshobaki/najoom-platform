import "server-only";

import { NextResponse } from "next/server";
import { AuthenticationRequiredError, AuthorizationDeniedError } from "@/lib/auth/authorization";
import { LessonItemServiceError, type LessonItemErrorCode, type LessonItemInput } from "@/lib/curriculum/curriculum-service";

export async function readLessonItemBody(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new LessonItemServiceError("invalid_request_body");
  }
  if (body === null || typeof body !== "object" || Array.isArray(body) || "sortOrder" in body) {
    throw new LessonItemServiceError("invalid_request_body");
  }
  return body as Record<string, unknown>;
}

export function parseLessonItemInput(body: Record<string, unknown>): LessonItemInput {
  if (typeof body.title !== "string") throw new LessonItemServiceError("invalid_item_title");
  if (body.description !== undefined && body.description !== null && typeof body.description !== "string") {
    throw new LessonItemServiceError("invalid_item_description");
  }
  return { title: body.title, description: body.description };
}

const messages: Record<LessonItemErrorCode, string> = {
  invalid_request_body: "بيانات الطلب غير صالحة.",
  invalid_lesson_id: "يجب تحديد درس صالح.",
  lesson_not_found: "الدرس المحدد غير موجود.",
  invalid_item_title: "يجب إدخال عنوان من حرف واحد إلى 150 حرفًا.",
  invalid_item_description: "يجب أن يكون الوصف نصًا لا يتجاوز 5000 حرف، أو يُترك فارغًا.",
  concept_not_found: "المفهوم غير موجود.",
  objective_not_found: "الهدف التعليمي غير موجود.",
};

export function lessonItemErrorResponse(error: unknown) {
  if (error instanceof AuthenticationRequiredError) {
    return NextResponse.json({ success: false, message: "يجب تسجيل الدخول أولًا." }, { status: 401 });
  }
  if (error instanceof AuthorizationDeniedError) {
    return NextResponse.json({ success: false, message: "ليس لديك صلاحية لتنفيذ هذه العملية." }, { status: 403 });
  }
  if (error instanceof LessonItemServiceError) {
    const status = ["lesson_not_found", "concept_not_found", "objective_not_found"].includes(error.code) ? 404 : 400;
    return NextResponse.json({ success: false, message: messages[error.code] }, { status });
  }
  console.error("Failed to save lesson item:", error);
  return NextResponse.json({ success: false, message: "حدث خطأ غير متوقع أثناء حفظ المفهوم أو الهدف التعليمي." }, { status: 500 });
}
