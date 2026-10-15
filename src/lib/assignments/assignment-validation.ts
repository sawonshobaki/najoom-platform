export type ExternalAssignmentCreateInput = {
  lessonId: string;
  title: string;
  description: string | null;
  externalUrl: string;
  weekNumber: number;
};

export class AssignmentValidationError extends Error {
  constructor(public readonly field: "input" | "lessonId" | "title" | "description" | "externalUrl" | "weekNumber", message: string) {
    super(message);
    this.name = "AssignmentValidationError";
  }
}

function requiredText(value: unknown, field: "lessonId" | "title", maxLength: number, message: string) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) throw new AssignmentValidationError(field, message);
  return value.trim();
}

export function validateExternalAssignmentCreate(input: unknown): ExternalAssignmentCreateInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new AssignmentValidationError("input", "بيانات الواجب غير صالحة.");
  const body = input as Record<string, unknown>;
  const allowed = new Set(["lessonId", "title", "description", "externalUrl", "weekNumber"]);
  if (Object.keys(body).some(key => !allowed.has(key))) throw new AssignmentValidationError("input", "تحتوي بيانات الواجب على حقول غير مسموحة.");
  const lessonId = requiredText(body.lessonId, "lessonId", 128, "يجب اختيار درس صالح.");
  const title = requiredText(body.title, "title", 200, "عنوان الواجب مطلوب وبحد أقصى 200 حرف.");
  if (body.description !== undefined && body.description !== null && typeof body.description !== "string") throw new AssignmentValidationError("description", "تعليمات الواجب غير صالحة.");
  const description = typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
  if (description && description.length > 2000) throw new AssignmentValidationError("description", "تعليمات الواجب يجب ألا تتجاوز 2000 حرف.");
  if (typeof body.externalUrl !== "string" || !body.externalUrl.trim() || body.externalUrl.trim().length > 2048) throw new AssignmentValidationError("externalUrl", "رابط الواجب مطلوب ويجب أن يكون رابط HTTPS صالحًا.");
  let url: URL;
  try { url = new URL(body.externalUrl.trim()); } catch { throw new AssignmentValidationError("externalUrl", "رابط الواجب يجب أن يكون رابط HTTPS صالحًا."); }
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password) throw new AssignmentValidationError("externalUrl", "يسمح بروابط HTTPS الآمنة فقط.");
  if (!Number.isInteger(body.weekNumber) || Number(body.weekNumber) < 1 || Number(body.weekNumber) > 2_147_483_647) throw new AssignmentValidationError("weekNumber", "رقم الأسبوع يجب أن يكون عددًا صحيحًا موجبًا.");
  return { lessonId, title, description, externalUrl: url.toString(), weekNumber: Number(body.weekNumber) };
}
