import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  skill: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  objective: { findUnique: vi.fn(), delete: vi.fn() },
  link: { create: vi.fn(), delete: vi.fn() },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: {
  skill: mocks.skill, learningObjective: mocks.objective, learningObjectiveSkill: mocks.link,
} }));
vi.mock("@/lib/auth/authorization", () => ({ requireAdmin: mocks.requireAdmin }));

import { listSkills, createSkill, updateSkill, addSkillToLearningObjective, removeSkillFromLearningObjective, type SkillInput } from "./curriculum-service";

const input = { name: "مهارة تجريبية", description: "وصف تجريبي" };
const skill = { id: "skill-1", ...input };
const link = { learningObjectiveId: "objective-1", skillId: "skill-1" };
const dbError = (code: string) => new Prisma.PrismaClientKnownRequestError("Database constraint", { code, clientVersion: "7.10.0" });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireAdmin.mockResolvedValue(undefined);
  mocks.skill.findMany.mockResolvedValue([skill]);
  mocks.skill.findUnique.mockResolvedValue({ id: skill.id });
  mocks.objective.findUnique.mockResolvedValue({ id: link.learningObjectiveId });
  mocks.skill.create.mockResolvedValue(skill);
  mocks.skill.update.mockResolvedValue(skill);
  mocks.link.create.mockResolvedValue(link);
  mocks.link.delete.mockResolvedValue(link);
});
afterEach(() => {
  expect(mocks.skill.delete).not.toHaveBeenCalled();
  expect(mocks.objective.delete).not.toHaveBeenCalled();
});

describe("listSkills", () => {
  it("reads all skills with stable alphabetical ordering", async () => {
    expect(await listSkills()).toEqual([skill]);
    expect(mocks.skill.findMany).toHaveBeenCalledWith({
      orderBy: [{ name: "asc" }, { id: "asc" }], select: { id: true, name: true, description: true },
    });
  });
  it("returns an empty list", async () => {
    mocks.skill.findMany.mockResolvedValue([]);
    expect(await listSkills()).toEqual([]);
  });
  it("requires admin before reading", async () => {
    const error = new Error("Denied");
    mocks.requireAdmin.mockRejectedValue(error);
    await expect(listSkills()).rejects.toBe(error);
    expect(mocks.skill.findMany).not.toHaveBeenCalled();
  });
  it("preserves database errors", async () => {
    const error = new Error("Database unavailable");
    mocks.skill.findMany.mockRejectedValue(error);
    await expect(listSkills()).rejects.toBe(error);
  });
});

for (const operation of ["create", "update"] as const) {
  describe(`${operation}Skill`, () => {
    const write = mocks.skill[operation];
    const save = (fields: SkillInput = input) => operation === "create" ? createSkill(fields) : updateSkill(" skill-1 ", fields);

    it("trims text and changes only descriptive fields", async () => {
      expect(await save({ name: ` ${input.name} `, description: ` ${input.description} ` })).toEqual(skill);
      expect(write.mock.calls[0][0].data).toEqual(input);
      expect(write.mock.calls[0][0].select).toEqual({ id: true, name: true, description: true });
      if (operation === "update") expect(write.mock.calls[0][0].where).toEqual({ id: skill.id });
    });
    it("requires admin before any database access", async () => {
      const error = new Error("Denied");
      mocks.requireAdmin.mockRejectedValue(error);
      await expect(save()).rejects.toBe(error);
      expect(write).not.toHaveBeenCalled();
      expect(mocks.skill.findUnique).not.toHaveBeenCalled();
    });
    it.each(["", " ", "a".repeat(151), null, 12])("rejects invalid name %j", async (name) => {
      await expect(save({ ...input, name } as unknown as SkillInput)).rejects.toMatchObject({ code: "invalid_skill_name" });
      expect(write).not.toHaveBeenCalled();
    });
    it.each(["a".repeat(5001), 12, [], {}])("rejects invalid description", async (description) => {
      await expect(save({ ...input, description } as unknown as SkillInput)).rejects.toMatchObject({ code: "invalid_skill_description" });
      expect(write).not.toHaveBeenCalled();
    });
    it("omits an unspecified description, preserving it on update", async () => {
      await save({ name: input.name });
      expect(write.mock.calls[0][0].data).toEqual({ name: input.name });
    });
    it.each([null, "", "  "])("clears explicit empty description %j", async (description) => {
      await save({ ...input, description });
      expect(write.mock.calls[0][0].data.description).toBeNull();
    });
    it("maps P2002 to a duplicate name", async () => {
      write.mockRejectedValue(dbError("P2002"));
      await expect(save()).rejects.toMatchObject({ code: "skill_name_conflict" });
    });
    it.each([new Error("Unexpected failure"), dbError("P2010")])("preserves unexpected database errors", async (error) => {
      write.mockRejectedValue(error);
      await expect(save()).rejects.toBe(error);
    });
  });
}

it("rejects a missing skill on update", async () => {
  mocks.skill.findUnique.mockResolvedValue(null);
  await expect(updateSkill("missing", input)).rejects.toMatchObject({ code: "skill_not_found" });
  expect(mocks.skill.update).not.toHaveBeenCalled();
});
it("rejects an empty skill id on update", async () => {
  await expect(updateSkill(" ", input)).rejects.toMatchObject({ code: "invalid_skill_id" });
  expect(mocks.skill.update).not.toHaveBeenCalled();
});
it("handles a skill removed during update", async () => {
  mocks.skill.update.mockRejectedValue(dbError("P2025"));
  await expect(updateSkill(skill.id, input)).rejects.toMatchObject({ code: "skill_not_found" });
});
it("preserves a skill lookup failure on update", async () => {
  const error = new Error("Lookup unavailable");
  mocks.skill.findUnique.mockRejectedValue(error);
  await expect(updateSkill(skill.id, input)).rejects.toBe(error);
  expect(mocks.skill.update).not.toHaveBeenCalled();
});

for (const operation of ["add", "remove"] as const) {
  describe(`${operation} objective-skill link`, () => {
    const write = operation === "add" ? mocks.link.create : mocks.link.delete;
    const save = (objectiveId = " objective-1 ", skillId = " skill-1 ") => operation === "add"
      ? addSkillToLearningObjective(objectiveId, skillId) : removeSkillFromLearningObjective(objectiveId, skillId);

    it("uses the exact objective-skill pair and preserves both parents", async () => {
      expect(await save()).toEqual(link);
      expect(mocks.objective.findUnique).toHaveBeenCalledWith({ where: { id: "objective-1" }, select: { id: true } });
      expect(mocks.skill.findUnique).toHaveBeenCalledWith({ where: { id: "skill-1" }, select: { id: true } });
      expect(write).toHaveBeenCalledWith({
        ...(operation === "add" ? { data: link } : { where: { learningObjectiveId_skillId: link } }),
        select: { learningObjectiveId: true, skillId: true },
      });
    });
    it("requires admin before lookups or writes", async () => {
      const error = new Error("Denied");
      mocks.requireAdmin.mockRejectedValue(error);
      await expect(save()).rejects.toBe(error);
      expect(mocks.objective.findUnique).not.toHaveBeenCalled();
      expect(mocks.skill.findUnique).not.toHaveBeenCalled();
      expect(write).not.toHaveBeenCalled();
    });
    it("rejects invalid objective ids", async () => {
      await expect(save(" ")).rejects.toMatchObject({ code: "invalid_objective_id" });
      expect(write).not.toHaveBeenCalled();
    });
    it("rejects invalid skill ids", async () => {
      await expect(save("objective-1", " ")).rejects.toMatchObject({ code: "invalid_skill_id" });
      expect(write).not.toHaveBeenCalled();
    });
    it("rejects a missing objective", async () => {
      mocks.objective.findUnique.mockResolvedValue(null);
      await expect(save()).rejects.toMatchObject({ code: "objective_not_found" });
      expect(write).not.toHaveBeenCalled();
    });
    it("rejects a missing skill", async () => {
      mocks.skill.findUnique.mockResolvedValue(null);
      await expect(save()).rejects.toMatchObject({ code: "skill_not_found" });
      expect(write).not.toHaveBeenCalled();
    });
    for (const stage of ["objective", "skill", "write"] as const) {
      it(`preserves unexpected ${stage} errors`, async () => {
        const error = new Error("Database unavailable");
        (stage === "write" ? write : mocks[stage].findUnique).mockRejectedValue(error);
        await expect(save()).rejects.toBe(error);
      });
    }
  });
}

it("maps duplicate links to a conflict", async () => {
  mocks.link.create.mockRejectedValue(dbError("P2002"));
  await expect(addSkillToLearningObjective("objective-1", "skill-1")).rejects.toMatchObject({ code: "objective_skill_conflict" });
});
it("identifies an objective removed during linking", async () => {
  mocks.objective.findUnique.mockResolvedValueOnce({ id: "objective-1" }).mockResolvedValueOnce(null);
  mocks.link.create.mockRejectedValue(dbError("P2003"));
  await expect(addSkillToLearningObjective("objective-1", "skill-1")).rejects.toMatchObject({ code: "objective_not_found" });
});
it("identifies a skill removed during linking", async () => {
  mocks.skill.findUnique.mockResolvedValueOnce({ id: "skill-1" }).mockResolvedValueOnce(null);
  mocks.link.create.mockRejectedValue(dbError("P2003"));
  await expect(addSkillToLearningObjective("objective-1", "skill-1")).rejects.toMatchObject({ code: "skill_not_found" });
});
it("does not misclassify unrelated foreign-key errors", async () => {
  const error = dbError("P2003");
  mocks.link.create.mockRejectedValue(error);
  await expect(addSkillToLearningObjective("objective-1", "skill-1")).rejects.toBe(error);
});
it("reports a missing or concurrently removed link", async () => {
  mocks.link.delete.mockRejectedValue(dbError("P2025"));
  await expect(removeSkillFromLearningObjective("objective-1", "skill-1")).rejects.toMatchObject({ code: "objective_skill_not_found" });
});
it("preserves unexpected Prisma errors during unlinking", async () => {
  const error = dbError("P2010");
  mocks.link.delete.mockRejectedValue(error);
  await expect(removeSkillFromLearningObjective("objective-1", "skill-1")).rejects.toBe(error);
});
