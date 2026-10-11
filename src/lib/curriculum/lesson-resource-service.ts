import "server-only";

import { LessonResourceType } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";

export type LessonResourceErrorCode =
  | "invalid_request_body" | "invalid_lesson_id" | "invalid_resource_id"
  | "invalid_resource_title" | "invalid_resource_url" | "invalid_resource_type"
  | "invalid_resource_language" | "invalid_resource_is_free" | "invalid_resource_instructions"
  | "invalid_sort_order" | "lesson_not_found" | "resource_not_found";

export class LessonResourceServiceError extends Error {
  constructor(public readonly code: LessonResourceErrorCode) {
    super(code);
    this.name = "LessonResourceServiceError";
  }
}

export type LessonResourceInput = {
  title: string;
  url: string;
  type: LessonResourceType;
  language: string;
  isFree: boolean;
  instructionsArabic?: string | null;
  sortOrder: number;
};

export const lessonResourceSelect = {
  id: true, lessonId: true, title: true, url: true, type: true, language: true,
  isFree: true, instructionsArabic: true, sortOrder: true, createdAt: true, updatedAt: true,
} as const;

function normalizeId(value: string, code: "invalid_lesson_id" | "invalid_resource_id") {
  if (typeof value !== "string" || !value.trim()) throw new LessonResourceServiceError(code);
  return value.trim();
}

function normalizeInput(input: LessonResourceInput): LessonResourceInput {
  if (typeof input.title !== "string" || !input.title.trim() || input.title.trim().length > 150) {
    throw new LessonResourceServiceError("invalid_resource_title");
  }
  if (typeof input.url !== "string" || input.url.trim().length > 2048 || !/^https?:\/\//i.test(input.url.trim())) {
    throw new LessonResourceServiceError("invalid_resource_url");
  }
  let url: URL;
  try { url = new URL(input.url.trim()); }
  catch { throw new LessonResourceServiceError("invalid_resource_url"); }
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new LessonResourceServiceError("invalid_resource_url");
  }
  if (!Object.values(LessonResourceType).includes(input.type)) throw new LessonResourceServiceError("invalid_resource_type");
  if (typeof input.language !== "string" || !input.language.trim() || input.language.trim().length > 50) {
    throw new LessonResourceServiceError("invalid_resource_language");
  }
  if (typeof input.isFree !== "boolean") throw new LessonResourceServiceError("invalid_resource_is_free");
  if (input.instructionsArabic !== undefined && input.instructionsArabic !== null && typeof input.instructionsArabic !== "string") {
    throw new LessonResourceServiceError("invalid_resource_instructions");
  }
  const instructionsArabic = input.instructionsArabic?.trim() || null;
  if (instructionsArabic && instructionsArabic.length > 5000) throw new LessonResourceServiceError("invalid_resource_instructions");
  if (!Number.isInteger(input.sortOrder) || input.sortOrder < 1 || input.sortOrder > 2_147_483_647) {
    throw new LessonResourceServiceError("invalid_sort_order");
  }
  return {
    title: input.title.trim(), url: input.url.trim(), type: input.type, language: input.language.trim(),
    isFree: input.isFree, sortOrder: input.sortOrder,
    ...(input.instructionsArabic !== undefined ? { instructionsArabic } : {}),
  };
}

async function requireLesson(id: string) {
  const lesson = await prisma.lesson.findUnique({ where: { id }, select: { id: true } });
  if (!lesson) throw new LessonResourceServiceError("lesson_not_found");
}

function mapWriteError(error: unknown): never {
  if (typeof error === "object" && error !== null && "code" in error) {
    if (error.code === "P2003") throw new LessonResourceServiceError("lesson_not_found");
    if (error.code === "P2025") throw new LessonResourceServiceError("resource_not_found");
  }
  throw error;
}

export async function listLessonResources(lessonId: string) {
  await requireAdmin();
  const id = normalizeId(lessonId, "invalid_lesson_id");
  await requireLesson(id);
  return prisma.lessonResource.findMany({
    where: { lessonId: id }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: lessonResourceSelect,
  });
}

export async function createLessonResource(input: LessonResourceInput & { lessonId: string }) {
  await requireAdmin();
  const lessonId = normalizeId(input.lessonId, "invalid_lesson_id");
  const data = normalizeInput(input);
  await requireLesson(lessonId);
  try {
    return await prisma.lessonResource.create({ data: { lessonId, ...data }, select: lessonResourceSelect });
  } catch (error) { mapWriteError(error); }
}

export async function updateLessonResource(resourceId: string, input: LessonResourceInput) {
  await requireAdmin();
  const id = normalizeId(resourceId, "invalid_resource_id");
  const data = normalizeInput(input);
  const resource = await prisma.lessonResource.findUnique({ where: { id }, select: { lessonId: true } });
  if (!resource) throw new LessonResourceServiceError("resource_not_found");
  await requireLesson(resource.lessonId);
  try {
    return await prisma.lessonResource.update({ where: { id }, data, select: lessonResourceSelect });
  } catch (error) { mapWriteError(error); }
}
