import "server-only";

import { NextResponse } from "next/server";
import {
  AuthenticationRequiredError,
  AuthorizationDeniedError,
} from "@/lib/auth/authorization";
import {
  CurriculumServiceError,
  type CurriculumServiceErrorCode,
  type SemesterInput,
} from "@/lib/curriculum/curriculum-service";

export async function readSemesterBody(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new CurriculumServiceError("invalid_request_body");
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new CurriculumServiceError("invalid_request_body");
  }
  return body as Record<string, unknown>;
}

export function parseSemesterInput(body: Record<string, unknown>): SemesterInput {
  if (typeof body.name !== "string") {
    throw new CurriculumServiceError("invalid_semester_name");
  }
  if (typeof body.academicYear !== "string") {
    throw new CurriculumServiceError("invalid_academic_year");
  }
  if (typeof body.sortOrder !== "number") {
    throw new CurriculumServiceError("invalid_sort_order");
  }
  return { name: body.name, academicYear: body.academicYear, sortOrder: body.sortOrder };
}

const messages: Record<CurriculumServiceErrorCode, string> = {
  invalid_request_body: "بيانات الطلب غير صالحة.",
  invalid_grade_id: "يجب تحديد صف صالح.",
  grade_not_found: "الصف المحدد غير موجود.",
  invalid_semester_name: "يجب إدخال اسم الفصل الدراسي من حرف واحد إلى 100 حرف.",
  invalid_academic_year: "يجب إدخال السنة الدراسية بصيغة YYYY-YYYY لسنتين متتاليتين، مثل 2026-2027.",
  invalid_sort_order: "يجب أن يكون ترتيب الفصل عددًا صحيحًا موجبًا لا يتجاوز 2147483647.",
  semester_not_found: "الفصل الدراسي غير موجود.",
  semester_order_conflict: "يوجد فصل دراسي بهذا الترتيب في الصف والسنة الدراسية نفسيهما. اختاري رقم ترتيب آخر.",
};

export function semesterErrorResponse(error: unknown) {
  if (error instanceof AuthenticationRequiredError) {
    return NextResponse.json({ success: false, message: "يجب تسجيل الدخول أولًا." }, { status: 401 });
  }
  if (error instanceof AuthorizationDeniedError) {
    return NextResponse.json({ success: false, message: "ليس لديك صلاحية لتنفيذ هذه العملية." }, { status: 403 });
  }
  if (error instanceof CurriculumServiceError) {
    const status = error.code === "semester_order_conflict" ? 409
      : error.code === "grade_not_found" || error.code === "semester_not_found" ? 404 : 400;
    return NextResponse.json({ success: false, message: messages[error.code] }, { status });
  }

  console.error("Failed to save semester:", error);
  return NextResponse.json({ success: false, message: "حدث خطأ غير متوقع أثناء حفظ الفصل الدراسي." }, { status: 500 });
}
