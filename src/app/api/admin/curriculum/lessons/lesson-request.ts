import "server-only";

import { NextResponse } from "next/server";
import { AuthenticationRequiredError, AuthorizationDeniedError } from "@/lib/auth/authorization";
import { LessonServiceError, type LessonServiceErrorCode, type LessonInput } from "@/lib/curriculum/curriculum-service";

export async function readLessonBody(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new LessonServiceError("invalid_request_body");
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new LessonServiceError("invalid_request_body");
  }
  return body as Record<string, unknown>;
}

export function parseLessonInput(body: Record<string, unknown>): LessonInput {
  if (typeof body.title !== "string") throw new LessonServiceError("invalid_lesson_title");
  if (typeof body.sortOrder !== "number") throw new LessonServiceError("invalid_sort_order");
  if (body.description !== undefined && body.description !== null && typeof body.description !== "string") {
    throw new LessonServiceError("invalid_lesson_description");
  }
  return { title: body.title, sortOrder: body.sortOrder, description: body.description };
}

const messages: Record<LessonServiceErrorCode, string> = {
  invalid_request_body: "بيانات الطلب غير صالحة.",
  invalid_unit_id: "يجب تحديد وحدة صالحة.",
  unit_not_found: "الوحدة المحددة غير موجودة.",
  invalid_lesson_title: "يجب إدخال عنوان الدرس من حرف واحد إلى 150 حرفًا.",
  invalid_lesson_description: "يجب أن يكون وصف الدرس نصًا لا يتجاوز 5000 حرف، أو يُترك فارغًا.",
  invalid_sort_order: "يجب أن يكون ترتيب الدرس عددًا صحيحًا موجبًا لا يتجاوز 2147483647.",
  lesson_not_found: "الدرس غير موجود.",
  lesson_order_conflict: "يوجد درس بهذا الترتيب في الوحدة نفسها. اختاري رقم ترتيب آخر.",
};

export function lessonErrorResponse(error: unknown) {
  if (error instanceof AuthenticationRequiredError) {
    return NextResponse.json({ success: false, message: "يجب تسجيل الدخول أولًا." }, { status: 401 });
  }
  if (error instanceof AuthorizationDeniedError) {
    return NextResponse.json({ success: false, message: "ليس لديك صلاحية لتنفيذ هذه العملية." }, { status: 403 });
  }
  if (error instanceof LessonServiceError) {
    const status = error.code === "lesson_order_conflict" ? 409
      : error.code === "unit_not_found" || error.code === "lesson_not_found" ? 404 : 400;
    return NextResponse.json({ success: false, message: messages[error.code] }, { status });
  }
  console.error("Failed to save lesson:", error);
  return NextResponse.json({ success: false, message: "حدث خطأ غير متوقع أثناء حفظ الدرس." }, { status: 500 });
}
