import { QuestionDifficulty } from "@/generated/prisma/enums";

export const V1_QUESTION_TYPES = ["MULTIPLE_CHOICE", "TRUE_FALSE"] as const;
export type V1QuestionType = (typeof V1_QUESTION_TYPES)[number];

export interface QuestionOptionInput {
  text: string;
  isCorrect: boolean;
}

export interface CreateQuestionInput {
  lessonId: string;
  learningObjectiveId?: string | null;
  text: string;
  explanation?: string;
  type: V1QuestionType;
  difficulty: QuestionDifficulty;
  options: QuestionOptionInput[];
}

export interface ValidatedQuestionInput extends Omit<CreateQuestionInput, "explanation" | "learningObjectiveId" | "options"> {
  explanation: string | null;
  learningObjectiveId: string | null;
  options: (QuestionOptionInput & { sortOrder: number })[];
}

export type QuestionCreateRequest =
  | (Omit<CreateQuestionInput, "type"> & { type: "MULTIPLE_CHOICE" })
  | (Omit<CreateQuestionInput, "type" | "options"> & { type: "TRUE_FALSE"; correctAnswer: boolean });

/** Public create request: TRUE_FALSE labels are generated, never accepted from clients. */
export function validateQuestionCreateRequest(value: unknown): ValidatedQuestionInput {
  const input = record(value, ["lessonId", "learningObjectiveId", "text", "explanation", "type", "difficulty", "options", "correctAnswer"], "input");
  if (input.type !== "TRUE_FALSE") return validateCreateQuestionInput(input);
  record(input, ["lessonId", "learningObjectiveId", "text", "explanation", "type", "difficulty", "correctAnswer"], "input");
  if (typeof input.correctAnswer !== "boolean") throw new QuestionValidationError("correctAnswer", "يجب اختيار صحيح أو خطأ.");
  return validateCreateQuestionInput({
    lessonId: input.lessonId, learningObjectiveId: input.learningObjectiveId,
    text: input.text, explanation: input.explanation, type: "TRUE_FALSE", difficulty: input.difficulty,
    options: createTrueFalseOptions(input.correctAnswer),
  });
}

export class QuestionValidationError extends Error {
  constructor(public readonly field: string, message: string) {
    super(message);
    this.name = "QuestionValidationError";
  }
}

function record(value: unknown, allowed: readonly string[], field: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new QuestionValidationError(field, "يجب تقديم البيانات في كائن صالح.");
  }
  if (Reflect.ownKeys(value).some(key => typeof key !== "string" || !allowed.includes(key))) {
    throw new QuestionValidationError(field, "تحتوي البيانات على حقول غير مسموح بها.");
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new QuestionValidationError(field, `يجب إدخال نص من حرف واحد إلى ${max} حرفًا.`);
  }
  return value.trim();
}

// IDs are opaque non-empty strings, matching existing curriculum validators.
// Existence and objective/lesson membership belong in the future service layer.
function identifier(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new QuestionValidationError(field, "يجب تحديد معرّف صالح.");
  }
  return value.trim();
}

export function normalizeOptionText(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

/** Pure create contract: no authorization, HTTP handling or persistence. */
export function validateCreateQuestionInput(value: unknown): ValidatedQuestionInput {
  const input = record(value, ["lessonId", "learningObjectiveId", "text", "explanation", "type", "difficulty", "options"], "input");
  if (input.type !== "MULTIPLE_CHOICE" && input.type !== "TRUE_FALSE") {
    throw new QuestionValidationError("type", "نوع السؤال غير مدعوم في هذه المرحلة.");
  }
  const difficulty = Object.values(QuestionDifficulty).find(item => item === input.difficulty);
  if (!difficulty) throw new QuestionValidationError("difficulty", "يجب اختيار مستوى صعوبة صالح.");

  let explanation: string | null = null;
  if (input.explanation !== undefined) {
    if (typeof input.explanation !== "string" || input.explanation.trim().length > 5000) {
      throw new QuestionValidationError("explanation", "يجب أن يكون الشرح نصًا لا يتجاوز 5000 حرف.");
    }
    explanation = input.explanation.trim() || null;
  }
  if (!Array.isArray(input.options) || input.options.length < 2
    || input.options.length > (input.type === "TRUE_FALSE" ? 2 : 6)) {
    throw new QuestionValidationError("options", "يجب تقديم خيارين للصح والخطأ، ومن خيارين إلى ستة للاختيار من متعدد.");
  }
  const seen = new Set<string>();
  // Array.from also validates sparse array entries rather than skipping them.
  const options = Array.from(input.options, (value: unknown, index) => {
    const option = record(value, ["text", "isCorrect"], "options");
    const optionText = text(option.text, "options.text", 500);
    if (typeof option.isCorrect !== "boolean") {
      throw new QuestionValidationError("options.isCorrect", "يجب تحديد صحة الخيار بقيمة منطقية.");
    }
    const key = normalizeOptionText(optionText);
    if (seen.has(key)) throw new QuestionValidationError("options.text", "لا يجوز تكرار نص الخيارات.");
    seen.add(key);
    return { text: optionText, isCorrect: option.isCorrect, sortOrder: index + 1 };
  });
  if (options.filter(option => option.isCorrect).length !== 1) {
    throw new QuestionValidationError("options.isCorrect", "يجب تحديد إجابة صحيحة واحدة فقط.");
  }
  return {
    lessonId: identifier(input.lessonId, "lessonId"),
    learningObjectiveId: input.learningObjectiveId === undefined || input.learningObjectiveId === null
      ? null : identifier(input.learningObjectiveId, "learningObjectiveId"),
    text: text(input.text, "text", 5000), explanation,
    type: input.type, difficulty, options,
  };
}

/** Future TRUE_FALSE handlers can generate labels instead of accepting client text. */
export function createTrueFalseOptions(correctAnswer: boolean): QuestionOptionInput[] {
  if (typeof correctAnswer !== "boolean") {
    throw new QuestionValidationError("correctAnswer", "يجب اختيار صحيح أو خطأ.");
  }
  return [
    { text: "صحيح", isCorrect: correctAnswer },
    { text: "خطأ", isCorrect: !correctAnswer },
  ];
}
