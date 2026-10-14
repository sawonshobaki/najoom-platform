import { QuestionValidationError, type CreateQuestionInput, type QuestionCreateRequest, type QuestionOptionInput, type V1QuestionType } from "@/lib/questions/question-validation";

export type EditableOption = QuestionOptionInput & { key: number };
export type OptionAction =
  | { type: "add" }
  | { type: "remove"; key: number }
  | { type: "move"; key: number; direction: -1 | 1 }
  | { type: "text"; key: number; text: string }
  | { type: "correct"; key: number };

export const initialQuestionOptions: EditableOption[] = [
  { key: 1, text: "", isCorrect: false }, { key: 2, text: "", isCorrect: false },
];

export function questionOptionsReducer(options: EditableOption[], action: OptionAction): EditableOption[] {
  if (action.type === "add") return options.length >= 6 ? options : [...options, { key: Math.max(...options.map(o => o.key)) + 1, text: "", isCorrect: false }];
  const index = options.findIndex(o => o.key === action.key);
  if (index < 0) return options;
  if (action.type === "remove") return options.length <= 2 ? options : options.filter(o => o.key !== action.key);
  if (action.type === "text") return options.map(o => o.key === action.key ? { ...o, text: action.text } : o);
  if (action.type === "correct") return options.map(o => ({ ...o, isCorrect: o.key === action.key }));
  const next = index + action.direction;
  if (next < 0 || next >= options.length) return options;
  const moved = [...options];
  [moved[index], moved[next]] = [moved[next], moved[index]];
  return moved;
}

export function questionOptionPayload(options: EditableOption[]): QuestionOptionInput[] {
  return options.map(({ text, isCorrect }) => ({ text, isCorrect }));
}

export function buildQuestionCreatePayload(
  common: Omit<CreateQuestionInput, "type" | "options">,
  type: V1QuestionType,
  options: EditableOption[],
  correctAnswer: boolean | null,
): QuestionCreateRequest {
  if (type === "TRUE_FALSE") {
    if (correctAnswer === null) throw new QuestionValidationError("correctAnswer", "يجب اختيار صحيح أو خطأ.");
    return { ...common, type, correctAnswer };
  }
  return { ...common, type, options: questionOptionPayload(options) };
}

export function questionUpdatePayload(payload: QuestionCreateRequest) {
  const { lessonId, type, ...editable } = payload;
  void lessonId; void type;
  return editable;
}
