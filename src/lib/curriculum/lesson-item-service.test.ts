import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(), lessonFind: vi.fn(), gradeFind: vi.fn(),
  concept: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  objective: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: {
  grade: { findMany: mocks.gradeFind }, lesson: { findUnique: mocks.lessonFind },
  concept: mocks.concept, learningObjective: mocks.objective,
} }));
vi.mock("@/lib/auth/authorization", () => ({ requireAdmin: mocks.requireAdmin }));

import { createConcept, updateConcept, createLearningObjective, updateLearningObjective, listCurriculum } from "./curriculum-service";

const input = { title: "عنصر تجريبي", description: "وصف تجريبي" };
const item = { id: "item-1", lessonId: "lesson-1", ...input };
const dbError = (code: string) => new Prisma.PrismaClientKnownRequestError("Database constraint", { code, clientVersion: "7.10.0" });

for (const config of [
  { name: "concept", model: mocks.concept, create: createConcept, update: updateConcept, missing: "concept_not_found" },
  { name: "objective", model: mocks.objective, create: createLearningObjective, update: updateLearningObjective, missing: "objective_not_found" },
]) {
  describe(`${config.name} service`, () => {
    beforeEach(() => {
      vi.resetAllMocks();
      mocks.requireAdmin.mockResolvedValue(undefined);
      mocks.lessonFind.mockResolvedValue({ id: "lesson-1" });
      config.model.findUnique.mockResolvedValue({ lessonId: "lesson-1" });
      config.model.create.mockResolvedValue(item);
      config.model.update.mockResolvedValue(item);
    });

    for (const operation of ["create", "update"] as const) {
      describe(operation, () => {
        const save = (fields: { title: string; description?: string | null } = input) => operation === "create"
          ? config.create({ lessonId: " lesson-1 ", ...fields }) : config.update(" item-1 ", fields);
        const write = config.model[operation];

        it("trims text and writes only supported fields", async () => {
          expect(await save({ title: ` ${input.title} `, description: ` ${input.description} ` })).toEqual(item);
          expect(mocks.lessonFind).toHaveBeenCalledWith({ where: { id: "lesson-1" }, select: { id: true } });
          expect(write.mock.calls[0][0].data).toEqual(operation === "create" ? { lessonId: "lesson-1", ...input } : input);
          expect(write.mock.calls[0][0].select).toEqual({ id: true, lessonId: true, title: true, description: true });
          if (operation === "update") expect(write.mock.calls[0][0].where).toEqual({ id: "item-1" });
        });

        it("requires admin before database access", async () => {
          const error = new Error("Access denied");
          mocks.requireAdmin.mockRejectedValue(error);
          await expect(save()).rejects.toBe(error);
          expect(mocks.lessonFind).not.toHaveBeenCalled();
          expect(config.model.findUnique).not.toHaveBeenCalled();
          expect(write).not.toHaveBeenCalled();
        });

        it.each(["", "  ", "a".repeat(151)])("rejects invalid title %j", async (title) => {
          await expect(save({ ...input, title })).rejects.toMatchObject({ code: "invalid_item_title" });
          expect(write).not.toHaveBeenCalled();
        });

        it("rejects an oversized description", async () => {
          await expect(save({ ...input, description: "a".repeat(5001) })).rejects.toMatchObject({ code: "invalid_item_description" });
          expect(write).not.toHaveBeenCalled();
        });

        it("omits description when unspecified, preserving it on update", async () => {
          await save({ title: input.title });
          expect(write.mock.calls[0][0].data).not.toHaveProperty("description");
        });

        it.each([null, "", "  "])("clears an explicitly empty description %j", async (description) => {
          await save({ ...input, description });
          expect(write.mock.calls[0][0].data.description).toBeNull();
        });

        it("rejects a missing lesson", async () => {
          mocks.lessonFind.mockResolvedValue(null);
          await expect(save()).rejects.toMatchObject({ code: "lesson_not_found" });
          expect(write).not.toHaveBeenCalled();
        });

        it("maps a foreign-key race to lesson_not_found", async () => {
          write.mockRejectedValue(dbError("P2003"));
          await expect(save()).rejects.toMatchObject({ code: "lesson_not_found" });
        });

        it("preserves unexpected write errors", async () => {
          const error = new Error("Database unavailable");
          write.mockRejectedValue(error);
          await expect(save()).rejects.toBe(error);
        });

        it("preserves unexpected lesson lookup errors", async () => {
          const error = new Error("Database lookup failed");
          mocks.lessonFind.mockRejectedValue(error);
          await expect(save()).rejects.toBe(error);
          expect(write).not.toHaveBeenCalled();
        });
      });
    }

    it("rejects an empty parent id", async () => {
      await expect(config.create({ ...input, lessonId: " " })).rejects.toMatchObject({ code: "invalid_lesson_id" });
      expect(config.model.create).not.toHaveBeenCalled();
    });

    it("rejects a missing item", async () => {
      config.model.findUnique.mockResolvedValue(null);
      await expect(config.update("missing", input)).rejects.toMatchObject({ code: config.missing });
      expect(config.model.update).not.toHaveBeenCalled();
    });

    it("rejects an empty item id", async () => {
      await expect(config.update(" ", input)).rejects.toMatchObject({ code: config.missing });
      expect(config.model.update).not.toHaveBeenCalled();
    });

    it("handles an item disappearing during update", async () => {
      config.model.update.mockRejectedValue(dbError("P2025"));
      await expect(config.update("item-1", input)).rejects.toMatchObject({ code: config.missing });
    });

    it("preserves unexpected item lookup errors", async () => {
      const error = new Error("Database lookup failed");
      config.model.findUnique.mockRejectedValue(error);
      await expect(config.update("item-1", input)).rejects.toBe(error);
      expect(config.model.update).not.toHaveBeenCalled();
    });
  });
}

it("reads concepts and objectives with linked skills but without new ordering", async () => {
  vi.resetAllMocks();
  mocks.requireAdmin.mockResolvedValue(undefined);
  mocks.gradeFind.mockResolvedValue([]);
  await listCurriculum();
  const selection = mocks.gradeFind.mock.calls[0][0].select.semesters.select.units.select.lessons.select;
  expect(selection.concepts).toEqual({ select: { id: true, title: true, description: true } });
  expect(selection.learningObjectives).toEqual({ select: {
    id: true, title: true, description: true,
    skills: { select: { skill: { select: { id: true, name: true, description: true } } } },
  } });
});
