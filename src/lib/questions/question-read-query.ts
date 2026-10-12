import { QuestionDifficulty } from "@/generated/prisma/enums";
import { V1_QUESTION_TYPES, type V1QuestionType } from "./question-validation";

export interface QuestionListInput {
  gradeId?: string;
  semesterId?: string;
  unitId?: string;
  lessonId?: string;
  type?: V1QuestionType;
  difficulty?: QuestionDifficulty;
  page?: number;
  pageSize?: number;
}
export type QuestionListQuery = QuestionListInput & { page: number; pageSize: number };
export const QUESTION_FILTER_KEYS = ["gradeId", "semesterId", "unitId", "lessonId", "type", "difficulty"] as const;
export class QuestionReadValidationError extends Error {
  constructor() { super("معايير البحث غير صالحة. اختاري قيمًا صحيحة ورقم صفحة من 1 إلى 10000 وحجم صفحة من 1 إلى 50."); }
}

export function validateQuestionListInput(input: QuestionListInput): QuestionListQuery {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new QuestionReadValidationError();
  const page = input.page === undefined ? 1 : input.page;
  const pageSize = input.pageSize === undefined ? 20 : input.pageSize;
  if (!Number.isInteger(page) || page < 1 || page > 10000
    || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) throw new QuestionReadValidationError();
  const result: QuestionListQuery = { page, pageSize };
  for (const key of ["gradeId", "semesterId", "unitId", "lessonId"] as const) {
    const value = input[key];
    if (value !== undefined) {
      if (typeof value !== "string" || !value.trim() || value.trim().length > 128) throw new QuestionReadValidationError();
      result[key] = value.trim();
    }
  }
  if (input.type !== undefined) {
    if (!V1_QUESTION_TYPES.some(type => type === input.type)) throw new QuestionReadValidationError();
    result.type = input.type;
  }
  if (input.difficulty !== undefined) {
    if (!Object.values(QuestionDifficulty).some(value => value === input.difficulty)) throw new QuestionReadValidationError();
    result.difficulty = input.difficulty;
  }
  return result;
}

/** Shared by the GET route and server page; duplicate parameters are invalid. */
export function parseQuestionQuery(params: URLSearchParams): QuestionListQuery {
  for (const key of params.keys()) {
    if (![...QUESTION_FILTER_KEYS, "page", "pageSize"].includes(key) || params.getAll(key).length !== 1) throw new QuestionReadValidationError();
  }
  const number = (key: string): number | undefined => {
    const value = params.get(key);
    if (value === null) return undefined;
    if (!/^[1-9]\d*$/.test(value)) throw new QuestionReadValidationError();
    return Number(value);
  };
  return validateQuestionListInput({
    gradeId: params.get("gradeId") ?? undefined, semesterId: params.get("semesterId") ?? undefined,
    unitId: params.get("unitId") ?? undefined, lessonId: params.get("lessonId") ?? undefined,
    type: (params.get("type") ?? undefined) as V1QuestionType | undefined,
    difficulty: (params.get("difficulty") ?? undefined) as QuestionDifficulty | undefined,
    page: number("page"), pageSize: number("pageSize"),
  });
}

export function questionListUrl(query: QuestionListQuery, page = query.page): string {
  const params = new URLSearchParams();
  for (const key of QUESTION_FILTER_KEYS) if (query[key]) params.set(key, query[key]);
  params.set("page", String(page));
  params.set("pageSize", String(query.pageSize));
  return `/admin/questions?${params}`;
}
