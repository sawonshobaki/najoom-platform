export class AttemptValidationError extends Error {
  constructor(message: string) { super(message); }
}

export function validAttemptId(value: unknown) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 128) throw new AttemptValidationError("معرّف المحاولة غير صالح.");
  return value.trim();
}

export function validateAnswerRequest(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new AttemptValidationError("بيانات الإجابة غير صالحة.");
  const body = input as Record<string, unknown>;
  if (Object.keys(body).length !== 1 || !("optionId" in body)) throw new AttemptValidationError("تحتوي الإجابة على حقول غير مسموحة.");
  if (typeof body.optionId !== "string" || !body.optionId.trim() || body.optionId.trim().length > 128) throw new AttemptValidationError("يجب اختيار إجابة صالحة.");
  return { optionId: body.optionId.trim() };
}
