import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(), lessonFind: vi.fn(),
  resource: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: { lesson: { findUnique: mocks.lessonFind }, lessonResource: mocks.resource } }));
vi.mock("@/lib/auth/authorization", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/auth/authorization")>(), requireAdmin: mocks.requireAdmin,
}));

import { AuthenticationRequiredError, AuthorizationDeniedError } from "@/lib/auth/authorization";
import { POST } from "./route";
import { PATCH } from "./[resourceId]/route";

const input = { title: "مورد تجريبي", url: "https://example.com/resource", type: "VIDEO", language: "العربية", isFree: true, instructionsArabic: "تعليمات تجريبية", sortOrder: 1 };
const resource = { id: "resource-1", lessonId: "lesson-1", ...input, createdAt: "2026-10-11T00:00:00.000Z", updatedAt: "2026-10-11T00:00:00.000Z" };
const dbError = (code: string) => new Prisma.PrismaClientKnownRequestError("Database constraint", { code, clientVersion: "7.10.0" });
const patch = (request: Request, resourceId = "resource-1") => PATCH(request, { params: Promise.resolve({ resourceId }) });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireAdmin.mockResolvedValue(undefined);
  mocks.lessonFind.mockResolvedValue({ id: "lesson-1" });
  mocks.resource.findUnique.mockResolvedValue({ lessonId: "lesson-1" });
  mocks.resource.create.mockResolvedValue(resource);
  mocks.resource.update.mockResolvedValue(resource);
});
afterEach(() => { expect(mocks.resource.delete).not.toHaveBeenCalled(); });

for (const method of ["POST", "PATCH"] as const) {
  describe(`resource ${method}`, () => {
    const handle = method === "POST" ? POST : patch;
    const bodyFor = () => method === "POST" ? { lessonId: "lesson-1", ...input } : input;
    const send = (body: unknown) => handle(new Request("http://localhost/api/admin/curriculum/resources", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
    const write = method === "POST" ? mocks.resource.create : mocks.resource.update;

    it("saves valid fields", async () => {
      const response = await send(bodyFor());
      expect(response.status).toBe(method === "POST" ? 201 : 200);
      expect(await response.json()).toEqual({ success: true, resource });
      expect(write).toHaveBeenCalledTimes(1);
    });
    it.each([null, [], "text", 12, true])("returns 400 for non-object body %j", async (body) => {
      const response = await send(body);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ success: false, message: "بيانات الطلب غير صالحة." });
      expect(write).not.toHaveBeenCalled();
    });
    it("returns 400 for malformed JSON", async () => {
      expect((await handle(new Request("http://localhost/api/admin/curriculum/resources", { method, body: "{" }))).status).toBe(400);
      expect(write).not.toHaveBeenCalled();
    });
    it.each([
      ["title", null], ["title", 12], ["title", " "], ["title", "a".repeat(151)],
      ["url", null], ["url", 12], ["url", "text"], ["url", "https://"], ["url", "https:example.com"],
      ["url", "javascript:alert(1)"], ["url", "ftp://example.com/file"], ["url", "https://user:password@example.com"],
      ["type", null], ["type", 12], ["type", "WEBSITE"], ["type", "video"],
      ["language", null], ["language", 12], ["language", " "], ["language", "a".repeat(51)],
      ["isFree", null], ["isFree", 1], ["isFree", "true"],
      ["instructionsArabic", 12], ["instructionsArabic", []], ["instructionsArabic", {}], ["instructionsArabic", "a".repeat(5001)],
      ["sortOrder", null], ["sortOrder", "1"], ["sortOrder", 0], ["sortOrder", -1], ["sortOrder", 1.5], ["sortOrder", 2147483648],
    ])("returns 400 for invalid %s", async (field, value) => {
      const response = await send({ ...bodyFor(), [field as string]: value });
      expect(response.status).toBe(400);
      expect((await response.json()).message).toMatch(/[\u0600-\u06FF]/);
      expect(write).not.toHaveBeenCalled();
    });
    it.each(["title", "url", "type", "language", "isFree", "sortOrder"])("rejects missing required %s", async (field) => {
      const body: Record<string, unknown> = { ...bodyFor() };
      delete body[field];
      expect((await send(body)).status).toBe(400);
      expect(write).not.toHaveBeenCalled();
    });
    it.each(["VIDEO", "GAME", "SIMULATION", "ARTICLE"])("accepts type %s", async (type) => {
      expect((await send({ ...bodyFor(), type })).status).toBe(method === "POST" ? 201 : 200);
      expect(write.mock.calls[0][0].data.type).toBe(type);
    });
    it("accepts non-free resources", async () => {
      expect((await send({ ...bodyFor(), isFree: false })).status).toBe(method === "POST" ? 201 : 200);
      expect(write.mock.calls[0][0].data.isFree).toBe(false);
    });
    it("allows omitted optional instructions", async () => {
      const body: Record<string, unknown> = { ...bodyFor() };
      delete body.instructionsArabic;
      expect((await send(body)).status).toBe(method === "POST" ? 201 : 200);
      expect(write.mock.calls[0][0].data).not.toHaveProperty("instructionsArabic");
    });
    it.each([null, "", " "])("allows clearing instructions %j", async (instructionsArabic) => {
      expect((await send({ ...bodyFor(), instructionsArabic })).status).toBe(method === "POST" ? 201 : 200);
      expect(write.mock.calls[0][0].data.instructionsArabic).toBeNull();
    });
    it.each([
      { error: new AuthenticationRequiredError(), status: 401 },
      { error: new AuthorizationDeniedError(), status: 403 },
    ])("returns $status before input or database access", async ({ error, status }) => {
      mocks.requireAdmin.mockRejectedValue(error);
      const request = new Request("http://localhost/api/admin/curriculum/resources", { method, body: "{" });
      const jsonSpy = vi.spyOn(request, "json");
      expect((await handle(request)).status).toBe(status);
      expect(jsonSpy).not.toHaveBeenCalled();
      expect(mocks.lessonFind).not.toHaveBeenCalled();
      expect(mocks.resource.findUnique).not.toHaveBeenCalled();
      expect(write).not.toHaveBeenCalled();
    });
    it("returns 404 for a missing lesson", async () => {
      mocks.lessonFind.mockResolvedValue(null);
      const response = await send(bodyFor());
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ success: false, message: "الدرس المحدد غير موجود." });
      expect(write).not.toHaveBeenCalled();
    });
    it("returns 404 for a lesson foreign-key race", async () => {
      write.mockRejectedValue(dbError("P2003"));
      expect((await send(bodyFor())).status).toBe(404);
    });
    it.each([new Error("Sensitive database details"), dbError("P2010")])("keeps unexpected write errors private", async (error) => {
      const logSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      try {
        write.mockRejectedValue(error);
        const response = await send(bodyFor());
        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({ success: false, message: "حدث خطأ غير متوقع أثناء حفظ مورد الدرس." });
      } finally { logSpy.mockRestore(); }
    });
    it("keeps unexpected lesson lookup errors private", async () => {
      const logSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      try {
        mocks.lessonFind.mockRejectedValue(new Error("Sensitive lookup details"));
        const response = await send(bodyFor());
        expect(response.status).toBe(500);
        expect(JSON.stringify(await response.json())).not.toContain("Sensitive");
        expect(write).not.toHaveBeenCalled();
      } finally { logSpy.mockRestore(); }
    });
  });
}

it.each([undefined, null, 12, " "])("rejects invalid creation lessonId %j", async (lessonId) => {
  expect((await POST(new Request("http://localhost/api/admin/curriculum/resources", { method: "POST", body: JSON.stringify({ ...input, lessonId }) }))).status).toBe(400);
  expect(mocks.resource.create).not.toHaveBeenCalled();
});
it("returns 404 for a missing resource", async () => {
  mocks.resource.findUnique.mockResolvedValue(null);
  const response = await patch(new Request("http://localhost/api/admin/curriculum/resources/resource-1", { method: "PATCH", body: JSON.stringify(input) }));
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ success: false, message: "المورد غير موجود." });
  expect(mocks.resource.update).not.toHaveBeenCalled();
});
it("returns 404 if a resource disappears during update", async () => {
  mocks.resource.update.mockRejectedValue(dbError("P2025"));
  expect((await patch(new Request("http://localhost/api/admin/curriculum/resources/resource-1", { method: "PATCH", body: JSON.stringify(input) }))).status).toBe(404);
});
it("rejects an empty resource path id", async () => {
  expect((await patch(new Request("http://localhost/api/admin/curriculum/resources/resource-1", { method: "PATCH", body: JSON.stringify(input) }), " ")).status).toBe(400);
  expect(mocks.resource.update).not.toHaveBeenCalled();
});
it("rejects moving a resource to another lesson", async () => {
  expect((await patch(new Request("http://localhost/api/admin/curriculum/resources/resource-1", { method: "PATCH", body: JSON.stringify({ ...input, lessonId: "lesson-2" }) }))).status).toBe(400);
  expect(mocks.resource.update).not.toHaveBeenCalled();
});
it("keeps unexpected resource lookup errors private", async () => {
  const logSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    mocks.resource.findUnique.mockRejectedValue(new Error("Sensitive lookup details"));
    const response = await patch(new Request("http://localhost/api/admin/curriculum/resources/resource-1", { method: "PATCH", body: JSON.stringify(input) }));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("Sensitive");
    expect(mocks.resource.update).not.toHaveBeenCalled();
  } finally { logSpy.mockRestore(); }
});
