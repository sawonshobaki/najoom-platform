import "server-only";

import { NextResponse } from "next/server";
import { LessonResourceType } from "@/generated/prisma/enums";
import { AuthenticationRequiredError, AuthorizationDeniedError } from "@/lib/auth/authorization";
import { LessonResourceServiceError, type LessonResourceErrorCode, type LessonResourceInput } from "@/lib/curriculum/lesson-resource-service";

export async function readResourceBody(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try { body = await request.json(); }
  catch { throw new LessonResourceServiceError("invalid_request_body"); }
  if (body === null || typeof body !== "object" || Array.isArray(body)) throw new LessonResourceServiceError("invalid_request_body");
  return body as Record<string, unknown>;
}

function isResourceType(value: unknown): value is LessonResourceType {
  return Object.values(LessonResourceType).some((type) => type === value);
}

export function parseResourceInput(body: Record<string, unknown>): LessonResourceInput {
  if (typeof body.title !== "string") throw new LessonResourceServiceError("invalid_resource_title");
  if (typeof body.url !== "string") throw new LessonResourceServiceError("invalid_resource_url");
  if (!isResourceType(body.type)) throw new LessonResourceServiceError("invalid_resource_type");
  if (typeof body.language !== "string") throw new LessonResourceServiceError("invalid_resource_language");
  if (typeof body.isFree !== "boolean") throw new LessonResourceServiceError("invalid_resource_is_free");
  if (typeof body.sortOrder !== "number") throw new LessonResourceServiceError("invalid_sort_order");
  if (body.instructionsArabic !== undefined && body.instructionsArabic !== null && typeof body.instructionsArabic !== "string") {
    throw new LessonResourceServiceError("invalid_resource_instructions");
  }
  return {
    title: body.title, url: body.url, type: body.type, language: body.language,
    isFree: body.isFree, instructionsArabic: body.instructionsArabic, sortOrder: body.sortOrder,
  };
}

const messages: Record<LessonResourceErrorCode, string> = {
  invalid_request_body: "بيانات الطلب غير صالحة.",
  invalid_lesson_id: "يجب تحديد درس صالح.",
  invalid_resource_id: "يجب تحديد مورد صالح.",
  invalid_resource_title: "يجب إدخال عنوان المورد من حرف واحد إلى 150 حرفًا.",
  invalid_resource_url: "يجب إدخال رابط صالح يبدأ بـ http:// أو https://، دون بيانات دخول، ولا يتجاوز 2048 حرفًا.",
  invalid_resource_type: "اختاري نوعًا صالحًا: فيديو أو لعبة أو محاكاة أو مقالة.",
  invalid_resource_language: "يجب إدخال لغة المورد من حرف واحد إلى 50 حرفًا.",
  invalid_resource_is_free: "يجب تحديد ما إذا كان المورد مجانيًا بقيمة صحيحة أو خاطئة.",
  invalid_resource_instructions: "يجب أن تكون التعليمات العربية نصًا لا يتجاوز 5000 حرف، أو تُترك فارغة.",
  invalid_sort_order: "يجب أن يكون ترتيب المورد عددًا صحيحًا موجبًا لا يتجاوز 2147483647.",
  lesson_not_found: "الدرس المحدد غير موجود.",
  resource_not_found: "المورد غير موجود.",
};

export function resourceErrorResponse(error: unknown) {
  if (error instanceof AuthenticationRequiredError) {
    return NextResponse.json({ success: false, message: "يجب تسجيل الدخول أولًا." }, { status: 401 });
  }
  if (error instanceof AuthorizationDeniedError) {
    return NextResponse.json({ success: false, message: "ليس لديك صلاحية لتنفيذ هذه العملية." }, { status: 403 });
  }
  if (error instanceof LessonResourceServiceError) {
    const status = ["lesson_not_found", "resource_not_found"].includes(error.code) ? 404 : 400;
    return NextResponse.json({ success: false, message: messages[error.code] }, { status });
  }
  console.error("Failed to save lesson resource:", error);
  return NextResponse.json({ success: false, message: "حدث خطأ غير متوقع أثناء حفظ مورد الدرس." }, { status: 500 });
}
