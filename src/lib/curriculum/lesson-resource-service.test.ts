import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { LessonResourceType } from "@/generated/prisma/enums";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(), lessonFind: vi.fn(),
  resource: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: { lesson: { findUnique: mocks.lessonFind }, lessonResource: mocks.resource } }));
vi.mock("@/lib/auth/authorization", () => ({ requireAdmin: mocks.requireAdmin }));

import { listLessonResources, createLessonResource, updateLessonResource, type LessonResourceInput } from "./lesson-resource-service";

const input: LessonResourceInput = {
  title: "مورد تجريبي", url: "https://example.com/resource", type: "VIDEO", language: "العربية",
  isFree: true, instructionsArabic: "تعليمات تجريبية", sortOrder: 1,
};
const resource = { id: "resource-1", lessonId: "lesson-1", ...input, createdAt: new Date(0), updatedAt: new Date(0) };
const dbError = (code: string) => new Prisma.PrismaClientKnownRequestError("Database constraint", { code, clientVersion: "7.10.0" });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireAdmin.mockResolvedValue(undefined);
  mocks.lessonFind.mockResolvedValue({ id: "lesson-1" });
  mocks.resource.findUnique.mockResolvedValue({ lessonId: "lesson-1" });
  mocks.resource.findMany.mockResolvedValue([resource]);
  mocks.resource.create.mockResolvedValue(resource);
  mocks.resource.update.mockResolvedValue(resource);
});
afterEach(() => { expect(mocks.resource.delete).not.toHaveBeenCalled(); });

describe("listLessonResources", () => {
  it("returns only the selected lesson's resources with stable ordering", async () => {
    expect(await listLessonResources(" lesson-1 ")).toEqual([resource]);
    expect(mocks.resource.findMany).toHaveBeenCalledWith({
      where: { lessonId: "lesson-1" }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: { id: true, lessonId: true, title: true, url: true, type: true, language: true,
        isFree: true, instructionsArabic: true, sortOrder: true, createdAt: true, updatedAt: true },
    });
  });
  it("returns an empty list for an existing lesson without resources", async () => {
    mocks.resource.findMany.mockResolvedValue([]);
    expect(await listLessonResources("lesson-1")).toEqual([]);
  });
  it("rejects a missing lesson", async () => {
    mocks.lessonFind.mockResolvedValue(null);
    await expect(listLessonResources("missing")).rejects.toMatchObject({ code: "lesson_not_found" });
    expect(mocks.resource.findMany).not.toHaveBeenCalled();
  });
  it("rejects an empty lesson id", async () => {
    await expect(listLessonResources(" ")).rejects.toMatchObject({ code: "invalid_lesson_id" });
    expect(mocks.resource.findMany).not.toHaveBeenCalled();
  });
  it("requires admin before reading", async () => {
    const error = new Error("Denied");
    mocks.requireAdmin.mockRejectedValue(error);
    await expect(listLessonResources("lesson-1")).rejects.toBe(error);
    expect(mocks.lessonFind).not.toHaveBeenCalled();
    expect(mocks.resource.findMany).not.toHaveBeenCalled();
  });
  it("preserves unexpected database failures", async () => {
    const error = dbError("P2010");
    mocks.resource.findMany.mockRejectedValue(error);
    await expect(listLessonResources("lesson-1")).rejects.toBe(error);
  });
});

for (const operation of ["create", "update"] as const) {
  describe(`${operation}LessonResource`, () => {
    const save = (fields: LessonResourceInput = input) => operation === "create"
      ? createLessonResource({ lessonId: " lesson-1 ", ...fields }) : updateLessonResource(" resource-1 ", fields);
    const write = mocks.resource[operation];

    it("trims text and preserves the resource's lesson on update", async () => {
      expect(await save({ ...input, title: ` ${input.title} `, url: ` ${input.url} `, language: ` ${input.language} `, instructionsArabic: ` ${input.instructionsArabic} ` })).toEqual(resource);
      expect(write.mock.calls[0][0].data).toEqual(operation === "create" ? { lessonId: "lesson-1", ...input } : input);
      expect(mocks.lessonFind).toHaveBeenCalledWith({ where: { id: "lesson-1" }, select: { id: true } });
      if (operation === "update") expect(write.mock.calls[0][0].where).toEqual({ id: "resource-1" });
    });
    it("requires admin before validation and database access", async () => {
      const error = new Error("Denied");
      mocks.requireAdmin.mockRejectedValue(error);
      await expect(save({ ...input, title: "" })).rejects.toBe(error);
      expect(mocks.lessonFind).not.toHaveBeenCalled();
      expect(mocks.resource.findUnique).not.toHaveBeenCalled();
      expect(write).not.toHaveBeenCalled();
    });
    it.each(Object.values(LessonResourceType))("accepts resource type %s", async (type) => {
      await save({ ...input, type });
      expect(write.mock.calls[0][0].data.type).toBe(type);
    });
    it.each(["http://example.com/resource", "https://example.com/resource"])("accepts HTTP/HTTPS URLs", async (url) => {
      await save({ ...input, url });
      expect(write.mock.calls[0][0].data.url).toBe(url);
    });
    it.each([
      "", "text", "/relative", "https://", "https:example.com", "ftp://example.com/file",
      "javascript:alert(1)", "data:text/html,test", "https://user:password@example.com/resource",
      `https://example.com/${"a".repeat(2048)}`,
    ])("rejects invalid or unsafe URL %s", async (url) => {
      await expect(save({ ...input, url })).rejects.toMatchObject({ code: "invalid_resource_url" });
      expect(write).not.toHaveBeenCalled();
    });
    it.each([
      ["title", "", "invalid_resource_title"], ["title", "  ", "invalid_resource_title"], ["title", "a".repeat(151), "invalid_resource_title"],
      ["type", "WEBSITE", "invalid_resource_type"], ["type", "video", "invalid_resource_type"],
      ["language", " ", "invalid_resource_language"], ["language", "a".repeat(51), "invalid_resource_language"],
      ["isFree", "true", "invalid_resource_is_free"], ["isFree", 1, "invalid_resource_is_free"],
      ["instructionsArabic", 1, "invalid_resource_instructions"], ["instructionsArabic", "a".repeat(5001), "invalid_resource_instructions"],
    ])("rejects invalid %s", async (field, value, code) => {
      await expect(save({ ...input, [field as string]: value } as LessonResourceInput)).rejects.toMatchObject({ code });
      expect(write).not.toHaveBeenCalled();
    });
    it.each([0, -1, 1.5, NaN, Infinity, 2147483648])("rejects invalid sortOrder %s", async (sortOrder) => {
      await expect(save({ ...input, sortOrder })).rejects.toMatchObject({ code: "invalid_sort_order" });
      expect(write).not.toHaveBeenCalled();
    });
    it("accepts non-free resources", async () => {
      await save({ ...input, isFree: false });
      expect(write.mock.calls[0][0].data.isFree).toBe(false);
    });
    it("omits unspecified instructions, preserving them on update", async () => {
      const { instructionsArabic, ...fields } = input;
      expect(instructionsArabic).toBe("تعليمات تجريبية");
      await save(fields);
      expect(write.mock.calls[0][0].data).not.toHaveProperty("instructionsArabic");
    });
    it.each([null, "", "  "])("clears explicit empty instructions %j", async (instructionsArabic) => {
      await save({ ...input, instructionsArabic });
      expect(write.mock.calls[0][0].data.instructionsArabic).toBeNull();
    });
    it("rejects a missing lesson", async () => {
      mocks.lessonFind.mockResolvedValue(null);
      await expect(save()).rejects.toMatchObject({ code: "lesson_not_found" });
      expect(write).not.toHaveBeenCalled();
    });
    it("handles the lesson disappearing during the write", async () => {
      write.mockRejectedValue(dbError("P2003"));
      await expect(save()).rejects.toMatchObject({ code: "lesson_not_found" });
    });
    it.each([new Error("Database unavailable"), dbError("P2010")])("preserves unexpected write errors", async (error) => {
      write.mockRejectedValue(error);
      await expect(save()).rejects.toBe(error);
    });
    it("preserves unexpected lesson lookup errors", async () => {
      const error = new Error("Database unavailable");
      mocks.lessonFind.mockRejectedValue(error);
      await expect(save()).rejects.toBe(error);
      expect(write).not.toHaveBeenCalled();
    });
  });
}

it("rejects an empty lesson id on creation", async () => {
  await expect(createLessonResource({ ...input, lessonId: " " })).rejects.toMatchObject({ code: "invalid_lesson_id" });
  expect(mocks.resource.create).not.toHaveBeenCalled();
});
it("rejects a missing resource", async () => {
  mocks.resource.findUnique.mockResolvedValue(null);
  await expect(updateLessonResource("missing", input)).rejects.toMatchObject({ code: "resource_not_found" });
  expect(mocks.resource.update).not.toHaveBeenCalled();
});
it("rejects an empty resource id", async () => {
  await expect(updateLessonResource(" ", input)).rejects.toMatchObject({ code: "invalid_resource_id" });
  expect(mocks.resource.update).not.toHaveBeenCalled();
});
it("handles the resource disappearing during update", async () => {
  mocks.resource.update.mockRejectedValue(dbError("P2025"));
  await expect(updateLessonResource("resource-1", input)).rejects.toMatchObject({ code: "resource_not_found" });
});
it("preserves unexpected resource lookup errors", async () => {
  const error = new Error("Database unavailable");
  mocks.resource.findUnique.mockRejectedValue(error);
  await expect(updateLessonResource("resource-1", input)).rejects.toBe(error);
  expect(mocks.resource.update).not.toHaveBeenCalled();
});
