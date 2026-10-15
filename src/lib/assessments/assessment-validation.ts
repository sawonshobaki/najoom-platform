export const MAX_ASSESSMENT_QUESTIONS = 50;

export type AssessmentCreateInput = {
  title: string;
  lessonId: string;
  questionIds: string[];
};

export class AssessmentValidationError extends Error {
  constructor(public readonly field: "input" | "title" | "lessonId" | "questionIds", message: string) {
    super(message);
  }
}

function requiredId(value: unknown, field: "lessonId" | "questionIds") {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 128) {
    throw new AssessmentValidationError(field, "يجب اختيار درس وأسئلة صالحة.");
  }
  return value.trim();
}

export function validateAssessmentCreateRequest(input: unknown): AssessmentCreateInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new AssessmentValidationError("input", "بيانات الاختبار غير صالحة.");
  }
  const body = input as Record<string, unknown>;
  const allowed = new Set(["title", "lessonId", "questionIds"]);
  if (Object.keys(body).some(key => !allowed.has(key))) {
    throw new AssessmentValidationError("input", "تحتوي بيانات الاختبار على حقول غير مسموحة.");
  }
  if (typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 200) {
    throw new AssessmentValidationError("title", "عنوان الاختبار مطلوب وبحد أقصى 200 حرف.");
  }
  const lessonId = requiredId(body.lessonId, "lessonId");
  if (!Array.isArray(body.questionIds) || body.questionIds.length < 1 || body.questionIds.length > MAX_ASSESSMENT_QUESTIONS) {
    throw new AssessmentValidationError("questionIds", `اختاري من سؤال واحد إلى ${MAX_ASSESSMENT_QUESTIONS} سؤالًا.`);
  }
  const questionIds = body.questionIds.map(value => requiredId(value, "questionIds"));
  if (new Set(questionIds).size !== questionIds.length) {
    throw new AssessmentValidationError("questionIds", "لا يمكن تكرار السؤال داخل الاختبار.");
  }
  return { title: body.title.trim(), lessonId, questionIds };
}
