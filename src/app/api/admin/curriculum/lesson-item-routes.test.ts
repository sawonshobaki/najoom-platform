import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(), lessonFind: vi.fn(),
  concept: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  objective: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: {
  lesson: { findUnique: mocks.lessonFind }, concept: mocks.concept, learningObjective: mocks.objective,
} }));
vi.mock("@/lib/auth/authorization", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/auth/authorization")>(), requireAdmin: mocks.requireAdmin,
}));

import { AuthenticationRequiredError, AuthorizationDeniedError } from "@/lib/auth/authorization";
import { POST as createConcept } from "./concepts/route";
import { PATCH as updateConcept } from "./concepts/[conceptId]/route";
import { POST as createObjective } from "./objectives/route";
import { PATCH as updateObjective } from "./objectives/[objectiveId]/route";

const input = { title: "عنصر تجريبي", description: "وصف تجريبي" };
const item = { id: "item-1", lessonId: "lesson-1", ...input };
const dbError = (code: string) => new Prisma.PrismaClientKnownRequestError("Database constraint", { code, clientVersion: "7.10.0" });

for (const config of [
  { name: "concept", model: mocks.concept, post: createConcept, patch: (request: Request) => updateConcept(request, { params: Promise.resolve({ conceptId: "item-1" }) }), missingMessage: "المفهوم غير موجود." },
  { name: "objective", model: mocks.objective, post: createObjective, patch: (request: Request) => updateObjective(request, { params: Promise.resolve({ objectiveId: "item-1" }) }), missingMessage: "الهدف التعليمي غير موجود." },
]) {
  describe(`${config.name} APIs`, () => {
    beforeEach(() => {
      vi.resetAllMocks();
      mocks.requireAdmin.mockResolvedValue(undefined);
      mocks.lessonFind.mockResolvedValue({ id: "lesson-1" });
      config.model.findUnique.mockResolvedValue({ lessonId: "lesson-1" });
      config.model.create.mockResolvedValue(item);
      config.model.update.mockResolvedValue(item);
    });

    for (const method of ["POST", "PATCH"] as const) {
      describe(method, () => {
        const handle = method === "POST" ? config.post : config.patch;
        const bodyFor = () => method === "POST" ? { lessonId: "lesson-1", ...input } : input;
        const send = (body: unknown) => handle(new Request("http://localhost/api/admin/curriculum/items", {
          method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        }));
        const write = method === "POST" ? config.model.create : config.model.update;

        it("saves valid fields and returns the item", async () => {
          const response = await send(bodyFor());
          expect(response.status).toBe(method === "POST" ? 201 : 200);
          expect(await response.json()).toEqual({ success: true, [config.name]: item });
          expect(mocks.requireAdmin).toHaveBeenCalled();
          expect(write).toHaveBeenCalledTimes(1);
        });

        it.each([null, [], "text", 12, true])("returns 400 for non-object body %j", async (body) => {
          const response = await send(body);
          expect(response.status).toBe(400);
          expect(await response.json()).toEqual({ success: false, message: "بيانات الطلب غير صالحة." });
          expect(write).not.toHaveBeenCalled();
        });

        it("returns 400 for malformed JSON", async () => {
          expect((await handle(new Request("http://localhost/api/admin/curriculum/items", { method, body: "{" }))).status).toBe(400);
          expect(write).not.toHaveBeenCalled();
        });

        it.each([
          ["title", null], ["title", 12], ["title", ""], ["title", "  "], ["title", "a".repeat(151)],
          ["description", 12], ["description", {}], ["description", []], ["description", "a".repeat(5001)],
        ])("returns 400 for invalid %s", async (field, value) => {
          const response = await send({ ...bodyFor(), [field as string]: value });
          expect(response.status).toBe(400);
          expect((await response.json()).message).toMatch(/[\u0600-\u06FF]/);
          expect(write).not.toHaveBeenCalled();
        });

        it("rejects a missing required title", async () => {
          expect((await send(method === "POST" ? { lessonId: "lesson-1" } : {})).status).toBe(400);
          expect(write).not.toHaveBeenCalled();
        });

        it("does not accept a new sortOrder field", async () => {
          expect((await send({ ...bodyFor(), sortOrder: 1 })).status).toBe(400);
          expect(write).not.toHaveBeenCalled();
        });

        it("allows an omitted description", async () => {
          const body = method === "POST" ? { lessonId: "lesson-1", title: input.title } : { title: input.title };
          expect((await send(body)).status).toBe(method === "POST" ? 201 : 200);
          expect(write.mock.calls[0][0].data).not.toHaveProperty("description");
        });

        it.each([null, "", "  "])("allows explicitly clearing description %j", async (description) => {
          expect((await send({ ...bodyFor(), description })).status).toBe(method === "POST" ? 201 : 200);
          expect(write.mock.calls[0][0].data.description).toBeNull();
        });

        it.each([
          { error: new AuthenticationRequiredError(), status: 401 },
          { error: new AuthorizationDeniedError(), status: 403 },
        ])("returns $status before reading unauthorized input", async ({ error, status }) => {
          mocks.requireAdmin.mockRejectedValue(error);
          const request = new Request("http://localhost/api/admin/curriculum/items", { method, body: "{" });
          const jsonSpy = vi.spyOn(request, "json");
          expect((await handle(request)).status).toBe(status);
          expect(jsonSpy).not.toHaveBeenCalled();
          expect(mocks.lessonFind).not.toHaveBeenCalled();
          expect(config.model.findUnique).not.toHaveBeenCalled();
          expect(write).not.toHaveBeenCalled();
        });

        it("returns 404 for a missing lesson", async () => {
          mocks.lessonFind.mockResolvedValue(null);
          const response = await send(bodyFor());
          expect(response.status).toBe(404);
          expect(await response.json()).toEqual({ success: false, message: "الدرس المحدد غير موجود." });
          expect(write).not.toHaveBeenCalled();
        });

        it("returns 404 for a foreign-key race", async () => {
          write.mockRejectedValue(dbError("P2003"));
          expect((await send(bodyFor())).status).toBe(404);
        });

        for (const stage of ["write", "lesson lookup"] as const) {
          it(`keeps unexpected ${stage} errors private`, async () => {
            const logSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
            try {
              (stage === "write" ? write : mocks.lessonFind).mockRejectedValue(new Error("Sensitive database details"));
              const response = await send(bodyFor());
              expect(response.status).toBe(500);
              const body = await response.json();
              expect(body.success).toBe(false);
              expect(body.message).toMatch(/[\u0600-\u06FF]/);
              expect(JSON.stringify(body)).not.toContain("Sensitive");
            } finally { logSpy.mockRestore(); }
          });
        }
      });
    }

    it.each([undefined, null, 12, " "])("rejects invalid lessonId %j on creation", async (lessonId) => {
      const request = new Request("http://localhost/api/admin/curriculum/items", { method: "POST", body: JSON.stringify({ ...input, lessonId }) });
      expect((await config.post(request)).status).toBe(400);
      expect(config.model.create).not.toHaveBeenCalled();
    });

    it("rejects moving an existing item to another lesson", async () => {
      const request = new Request("http://localhost/api/admin/curriculum/items/item-1", { method: "PATCH", body: JSON.stringify({ ...input, lessonId: "lesson-2" }) });
      expect((await config.patch(request)).status).toBe(400);
      expect(config.model.update).not.toHaveBeenCalled();
    });

    it("returns 404 for a missing item", async () => {
      config.model.findUnique.mockResolvedValue(null);
      const response = await config.patch(new Request("http://localhost/api/admin/curriculum/items/item-1", { method: "PATCH", body: JSON.stringify(input) }));
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ success: false, message: config.missingMessage });
      expect(config.model.update).not.toHaveBeenCalled();
    });

    it("returns 404 if an item disappears during update", async () => {
      config.model.update.mockRejectedValue(dbError("P2025"));
      const response = await config.patch(new Request("http://localhost/api/admin/curriculum/items/item-1", { method: "PATCH", body: JSON.stringify(input) }));
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ success: false, message: config.missingMessage });
    });
  });
}
