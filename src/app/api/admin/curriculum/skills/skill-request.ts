import "server-only";

import { NextResponse } from "next/server";
import { AuthenticationRequiredError, AuthorizationDeniedError } from "@/lib/auth/authorization";
import { SkillServiceError, type SkillServiceErrorCode, type SkillInput } from "@/lib/curriculum/curriculum-service";

export async function readSkillBody(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try { body = await request.json(); }
  catch { throw new SkillServiceError("invalid_request_body"); }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new SkillServiceError("invalid_request_body");
  }
  return body as Record<string, unknown>;
}

export function parseSkillInput(body: Record<string, unknown>): SkillInput {
  if (typeof body.name !== "string") throw new SkillServiceError("invalid_skill_name");
  if (body.description !== undefined && body.description !== null && typeof body.description !== "string") {
    throw new SkillServiceError("invalid_skill_description");
  }
  return { name: body.name, description: body.description };
}

const messages: Record<SkillServiceErrorCode, string> = {
  invalid_request_body: "بيانات الطلب غير صالحة.",
  invalid_skill_name: "يجب إدخال اسم مهارة من حرف واحد إلى 150 حرفًا.",
  invalid_skill_description: "يجب أن يكون الوصف نصًا لا يتجاوز 5000 حرف، أو يُترك فارغًا.",
  invalid_skill_id: "يجب اختيار مهارة صالحة.",
  invalid_objective_id: "يجب تحديد هدف تعليمي صالح.",
  skill_not_found: "المهارة غير موجودة.",
  objective_not_found: "الهدف التعليمي غير موجود.",
  skill_name_conflict: "توجد مهارة بهذا الاسم بالفعل. اختاري اسمًا آخر.",
  objective_skill_conflict: "هذه المهارة مرتبطة بالهدف التعليمي بالفعل.",
  objective_skill_not_found: "هذا الربط بين الهدف التعليمي والمهارة غير موجود.",
};

export function skillErrorResponse(error: unknown) {
  if (error instanceof AuthenticationRequiredError) {
    return NextResponse.json({ success: false, message: "يجب تسجيل الدخول أولًا." }, { status: 401 });
  }
  if (error instanceof AuthorizationDeniedError) {
    return NextResponse.json({ success: false, message: "ليس لديك صلاحية لتنفيذ هذه العملية." }, { status: 403 });
  }
  if (error instanceof SkillServiceError) {
    const status = ["skill_name_conflict", "objective_skill_conflict"].includes(error.code) ? 409
      : ["skill_not_found", "objective_not_found", "objective_skill_not_found"].includes(error.code) ? 404 : 400;
    return NextResponse.json({ success: false, message: messages[error.code] }, { status });
  }
  console.error("Failed to manage curriculum skills:", error);
  return NextResponse.json({ success: false, message: "حدث خطأ غير متوقع أثناء حفظ المهارة أو الربط." }, { status: 500 });
}
