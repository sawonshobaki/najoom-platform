export class AssignmentReviewValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssignmentReviewValidationError";
  }
}

export function validateAssignmentScore(input: unknown): 0 | 1 {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new AssignmentReviewValidationError("بيانات التقييم غير صالحة.");
  }

  const keys = Object.keys(input);
  if (keys.length !== 1 || keys[0] !== "score") {
    throw new AssignmentReviewValidationError("يجب إرسال قيمة التقييم فقط.");
  }

  const score = (input as { score?: unknown }).score;
  if (score !== 0 && score !== 1) {
    throw new AssignmentReviewValidationError("يجب أن يكون التقييم 0 أو 1 فقط.");
  }
  return score;
}
