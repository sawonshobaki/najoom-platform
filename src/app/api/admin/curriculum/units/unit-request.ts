import "server-only";

import { NextResponse } from "next/server";
import { AuthenticationRequiredError, AuthorizationDeniedError } from "@/lib/auth/authorization";
import { UnitServiceError, type UnitServiceErrorCode, type UnitInput } from "@/lib/curriculum/curriculum-service";

export async function readUnitBody(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new UnitServiceError("invalid_request_body");
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new UnitServiceError("invalid_request_body");
  }
  return body as Record<string, unknown>;
}

export function parseUnitInput(body: Record<string, unknown>): UnitInput {
  if (typeof body.title !== "string") throw new UnitServiceError("invalid_unit_title");
  if (typeof body.sortOrder !== "number") throw new UnitServiceError("invalid_sort_order");
  if (body.description !== undefined && body.description !== null && typeof body.description !== "string") {
    throw new UnitServiceError("invalid_unit_description");
  }
  return { title: body.title, sortOrder: body.sortOrder, description: body.description };
}

const messages: Record<UnitServiceErrorCode, string> = {
  invalid_request_body: "بيانات الطلب غير صالحة.",
  invalid_semester_id: "يجب تحديد فصل دراسي صالح.",
  semester_not_found: "الفصل الدراسي المحدد غير موجود.",
  invalid_unit_title: "يجب إدخال عنوان الوحدة من حرف واحد إلى 150 حرفًا.",
  invalid_unit_description: "يجب أن يكون وصف الوحدة نصًا لا يتجاوز 5000 حرف، أو يُترك فارغًا.",
  invalid_sort_order: "يجب أن يكون ترتيب الوحدة عددًا صحيحًا موجبًا لا يتجاوز 2147483647.",
  unit_not_found: "الوحدة غير موجودة.",
  unit_order_conflict: "توجد وحدة بهذا الترتيب في الفصل الدراسي نفسه. اختاري رقم ترتيب آخر.",
};

export function unitErrorResponse(error: unknown) {
  if (error instanceof AuthenticationRequiredError) {
    return NextResponse.json({ success: false, message: "يجب تسجيل الدخول أولًا." }, { status: 401 });
  }
  if (error instanceof AuthorizationDeniedError) {
    return NextResponse.json({ success: false, message: "ليس لديك صلاحية لتنفيذ هذه العملية." }, { status: 403 });
  }
  if (error instanceof UnitServiceError) {
    const status = error.code === "unit_order_conflict" ? 409
      : error.code === "semester_not_found" || error.code === "unit_not_found" ? 404 : 400;
    return NextResponse.json({ success: false, message: messages[error.code] }, { status });
  }
  console.error("Failed to save unit:", error);
  return NextResponse.json({ success: false, message: "حدث خطأ غير متوقع أثناء حفظ الوحدة." }, { status: 500 });
}
