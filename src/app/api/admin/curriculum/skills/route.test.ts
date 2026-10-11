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
vi.mock("@/lib/auth/authorization", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/auth/authorization")>(), requireAdmin: mocks.requireAdmin,
}));

import { AuthenticationRequiredError, AuthorizationDeniedError } from "@/lib/auth/authorization";
import { GET, POST } from "./route";
import { PATCH } from "./[skillId]/route";
import { POST as addLink } from "./objectives/[objectiveId]/route";
import { DELETE as removeLink } from "./objectives/[objectiveId]/[skillId]/route";

const input = { name: "مهارة تجريبية", description: "وصف تجريبي" };
const skill = { id: "skill-1", ...input };
const link = { learningObjectiveId: "objective-1", skillId: skill.id };
const dbError = (code: string) => new Prisma.PrismaClientKnownRequestError("Database constraint", { code, clientVersion: "7.10.0" });
const requestFor = (method: string, body: unknown) => new Request("http://localhost/api/admin/curriculum/skills", {
  method, headers: { "Content-Type": "application/json" }, ...(method !== "GET" ? { body: JSON.stringify(body) } : {}),
});
const patch = (request: Request, skillId = "skill-1") => PATCH(request, { params: Promise.resolve({ skillId }) });
const add = (request: Request, objectiveId = "objective-1") => addLink(request, { params: Promise.resolve({ objectiveId }) });
const remove = (request: Request, objectiveId = "objective-1", skillId = "skill-1") => removeLink(request, { params: Promise.resolve({ objectiveId, skillId }) });

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

for (const operation of [
  { name: "list", method: "GET", handle: () => GET(), body: undefined, write: mocks.skill.findMany, status: 200, output: { skills: [skill] } },
  { name: "create", method: "POST", handle: POST, body: input, write: mocks.skill.create, status: 201, output: { skill } },
  { name: "update", method: "PATCH", handle: patch, body: input, write: mocks.skill.update, status: 200, output: { skill } },
  { name: "link", method: "POST", handle: add, body: { skillId: skill.id }, write: mocks.link.create, status: 201, output: { link } },
  { name: "unlink", method: "DELETE", handle: remove, body: undefined, write: mocks.link.delete, status: 200, output: { link } },
]) {
  describe(operation.name, () => {
    const send = (body: unknown = operation.body) => operation.handle(requestFor(operation.method, body));

    it("returns a successful result", async () => {
      const response = await send();
      expect(response.status).toBe(operation.status);
      expect(await response.json()).toEqual({ success: true, ...operation.output });
      expect(mocks.requireAdmin).toHaveBeenCalled();
      expect(operation.write).toHaveBeenCalledTimes(1);
    });
    it.each([
      { error: new AuthenticationRequiredError(), status: 401 },
      { error: new AuthorizationDeniedError(), status: 403 },
    ])("returns $status before input or database access", async ({ error, status }) => {
      mocks.requireAdmin.mockRejectedValue(error);
      const request = requestFor(operation.method, operation.body);
      const jsonSpy = vi.spyOn(request, "json");
      expect((await operation.handle(request)).status).toBe(status);
      expect(jsonSpy).not.toHaveBeenCalled();
      expect(mocks.skill.findUnique).not.toHaveBeenCalled();
      expect(mocks.objective.findUnique).not.toHaveBeenCalled();
      expect(operation.write).not.toHaveBeenCalled();
    });
    it.each([new Error("Sensitive database details"), dbError("P2010")])("keeps unexpected database errors private", async (error) => {
      const logSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      try {
        operation.write.mockRejectedValue(error);
        const response = await send();
        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body.success).toBe(false);
        expect(body.message).toMatch(/[\u0600-\u06FF]/);
        expect(JSON.stringify(body)).not.toContain("Sensitive");
        expect(JSON.stringify(body)).not.toContain("Database constraint");
      } finally { logSpy.mockRestore(); }
    });

    if (["create", "update", "link"].includes(operation.name)) {
      it.each([null, [], "text", 12, true])("returns 400 for non-object body %j", async (body) => {
        const response = await send(body);
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ success: false, message: "بيانات الطلب غير صالحة." });
        expect(operation.write).not.toHaveBeenCalled();
      });
      it("returns 400 for malformed JSON", async () => {
        const request = new Request("http://localhost/api/admin/curriculum/skills", { method: operation.method, body: "{" });
        expect((await operation.handle(request)).status).toBe(400);
        expect(operation.write).not.toHaveBeenCalled();
      });
      it("returns 400 for missing required fields", async () => {
        expect((await send({})).status).toBe(400);
        expect(operation.write).not.toHaveBeenCalled();
      });
    }

    if (["create", "update"].includes(operation.name)) {
      it.each([
        ["name", ""], ["name", "  "], ["name", null], ["name", 12], ["name", "a".repeat(151)],
        ["description", 12], ["description", []], ["description", {}], ["description", "a".repeat(5001)],
      ])("returns 400 for invalid %s", async (field, value) => {
        const response = await send({ ...input, [field as string]: value });
        expect(response.status).toBe(400);
        expect((await response.json()).message).toMatch(/[\u0600-\u06FF]/);
        expect(operation.write).not.toHaveBeenCalled();
      });
      it("omits an unspecified description", async () => {
        expect((await send({ name: input.name })).status).toBe(operation.status);
        expect(operation.write.mock.calls[0][0].data).toEqual({ name: input.name });
      });
      it.each([null, "", "  "])("allows clearing description %j", async (description) => {
        expect((await send({ ...input, description })).status).toBe(operation.status);
        expect(operation.write.mock.calls[0][0].data.description).toBeNull();
      });
      it("returns 409 for a duplicate name", async () => {
        operation.write.mockRejectedValue(dbError("P2002"));
        const response = await send();
        expect(response.status).toBe(409);
        expect(await response.json()).toEqual({ success: false, message: "توجد مهارة بهذا الاسم بالفعل. اختاري اسمًا آخر." });
      });
    }

    if (["update", "link", "unlink"].includes(operation.name)) {
      it("returns 404 for a missing skill", async () => {
        mocks.skill.findUnique.mockResolvedValue(null);
        const response = await send();
        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({ success: false, message: "المهارة غير موجودة." });
        expect(operation.write).not.toHaveBeenCalled();
      });
      it("keeps unexpected skill lookup errors private", async () => {
        const logSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
        try {
          mocks.skill.findUnique.mockRejectedValue(new Error("Sensitive lookup details"));
          const response = await send();
          expect(response.status).toBe(500);
          expect(JSON.stringify(await response.json())).not.toContain("Sensitive");
          expect(operation.write).not.toHaveBeenCalled();
        } finally { logSpy.mockRestore(); }
      });
    }

    if (["link", "unlink"].includes(operation.name)) {
      it("returns 404 for a missing objective", async () => {
        mocks.objective.findUnique.mockResolvedValue(null);
        const response = await send();
        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({ success: false, message: "الهدف التعليمي غير موجود." });
        expect(operation.write).not.toHaveBeenCalled();
      });
      it("keeps unexpected objective lookup errors private", async () => {
        const logSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
        try {
          mocks.objective.findUnique.mockRejectedValue(new Error("Sensitive lookup details"));
          const response = await send();
          expect(response.status).toBe(500);
          expect(JSON.stringify(await response.json())).not.toContain("Sensitive");
          expect(operation.write).not.toHaveBeenCalled();
        } finally { logSpy.mockRestore(); }
      });
    }
  });
}

it("lists no skills when none exist", async () => {
  mocks.skill.findMany.mockResolvedValue([]);
  expect(await (await GET()).json()).toEqual({ success: true, skills: [] });
});
it("returns 400 for an invalid skill path id", async () => {
  expect((await patch(requestFor("PATCH", input), " ")).status).toBe(400);
  expect(mocks.skill.update).not.toHaveBeenCalled();
});
it("returns 404 if a skill disappears during update", async () => {
  mocks.skill.update.mockRejectedValue(dbError("P2025"));
  expect((await patch(requestFor("PATCH", input))).status).toBe(404);
});
it.each([null, [], 12, " "])("rejects invalid skillId %j when linking", async (skillId) => {
  expect((await add(requestFor("POST", { skillId }))).status).toBe(400);
  expect(mocks.link.create).not.toHaveBeenCalled();
});
it("rejects an invalid objective path id when linking", async () => {
  expect((await add(requestFor("POST", { skillId: skill.id }), " ")).status).toBe(400);
  expect(mocks.link.create).not.toHaveBeenCalled();
});
it("returns 409 for a duplicate link", async () => {
  mocks.link.create.mockRejectedValue(dbError("P2002"));
  const response = await add(requestFor("POST", { skillId: skill.id }));
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ success: false, message: "هذه المهارة مرتبطة بالهدف التعليمي بالفعل." });
});
it("returns 404 if the objective disappears during linking", async () => {
  mocks.objective.findUnique.mockResolvedValueOnce({ id: "objective-1" }).mockResolvedValueOnce(null);
  mocks.link.create.mockRejectedValue(dbError("P2003"));
  const response = await add(requestFor("POST", { skillId: skill.id }));
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ success: false, message: "الهدف التعليمي غير موجود." });
});
it("returns 404 if the skill disappears during linking", async () => {
  mocks.skill.findUnique.mockResolvedValueOnce({ id: skill.id }).mockResolvedValueOnce(null);
  mocks.link.create.mockRejectedValue(dbError("P2003"));
  const response = await add(requestFor("POST", { skillId: skill.id }));
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ success: false, message: "المهارة غير موجودة." });
});
it("removes only an existing link with a bodyless DELETE", async () => {
  const request = new Request("http://localhost/api/admin/curriculum/skills/objectives/objective-1/skill-1", { method: "DELETE" });
  const jsonSpy = vi.spyOn(request, "json");
  expect((await remove(request)).status).toBe(200);
  expect(jsonSpy).not.toHaveBeenCalled();
  expect(mocks.link.delete).toHaveBeenCalledWith({ where: { learningObjectiveId_skillId: link }, select: { learningObjectiveId: true, skillId: true } });
});
it("returns 404 for a missing or concurrently removed link", async () => {
  mocks.link.delete.mockRejectedValue(dbError("P2025"));
  const response = await remove(requestFor("DELETE", undefined));
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ success: false, message: "هذا الربط بين الهدف التعليمي والمهارة غير موجود." });
});
it.each([[" ", "skill-1"], ["objective-1", " "]])("returns 400 for invalid unlink path ids", async (objectiveId, skillId) => {
  expect((await remove(requestFor("DELETE", undefined), objectiveId, skillId)).status).toBe(400);
  expect(mocks.link.delete).not.toHaveBeenCalled();
});
