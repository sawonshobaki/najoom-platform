import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const { requireAdminMock, unitFindUniqueMock, lessonFindUniqueMock, lessonCreateMock, lessonUpdateMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(), unitFindUniqueMock: vi.fn(), lessonFindUniqueMock: vi.fn(), lessonCreateMock: vi.fn(), lessonUpdateMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    unit: { findUnique: unitFindUniqueMock },
    lesson: { findUnique: lessonFindUniqueMock, create: lessonCreateMock, update: lessonUpdateMock },
  },
}));
vi.mock("@/lib/auth/authorization", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/auth/authorization")>(),
  requireAdmin: requireAdminMock,
}));

import { AuthenticationRequiredError, AuthorizationDeniedError } from "@/lib/auth/authorization";
import { POST } from "./route";
import { PATCH } from "./[lessonId]/route";

const input = { title: "درس تجريبي", description: "وصف تجريبي", sortOrder: 1 };
const lesson = { id: "lesson-1", unitId: "unit-1", ...input };
const errorFor = (code: string) => new Prisma.PrismaClientKnownRequestError("Database constraint", { code, clientVersion: "7.10.0" });
const context = () => ({ params: Promise.resolve({ lessonId: "lesson-1" }) });

describe("lesson APIs", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAdminMock.mockResolvedValue(undefined);
    unitFindUniqueMock.mockResolvedValue({ id: "unit-1" });
    lessonFindUniqueMock.mockResolvedValue({ unitId: "unit-1" });
    lessonCreateMock.mockResolvedValue(lesson);
    lessonUpdateMock.mockResolvedValue(lesson);
  });

  for (const method of ["POST", "PATCH"] as const) {
    describe(method, () => {
      const bodyFor = () => method === "POST" ? { unitId: "unit-1", ...input } : input;
      const handle = (request: Request) => method === "POST" ? POST(request) : PATCH(request, context());
      const send = (body: unknown) => handle(new Request("http://localhost/api/admin/curriculum/lessons", {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      }));
      const writeMock = method === "POST" ? lessonCreateMock : lessonUpdateMock;

      it("saves valid lesson fields", async () => {
        const response = await send(bodyFor());
        expect(response.status).toBe(method === "POST" ? 201 : 200);
        expect(await response.json()).toEqual({ success: true, lesson });
        expect(requireAdminMock).toHaveBeenCalled();
        expect(writeMock).toHaveBeenCalledTimes(1);
      });

      it("allows an omitted optional description", async () => {
        const { description, ...body } = bodyFor();
        expect(description).toBe(input.description);
        const response = await send(body);
        expect(response.status).toBe(method === "POST" ? 201 : 200);
        expect(writeMock.mock.calls[0][0].data).not.toHaveProperty("description");
      });

      it.each([null, "", "  "])("accepts optional description %j", async (description) => {
        const response = await send({ ...bodyFor(), description });
        expect(response.status).toBe(method === "POST" ? 201 : 200);
        expect(writeMock.mock.calls[0][0].data.description).toBeNull();
      });

      it.each([null, [], "text", 12, true])("returns 400 for body %j", async (body) => {
        const response = await send(body);
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ success: false, message: "بيانات الطلب غير صالحة." });
        expect(writeMock).not.toHaveBeenCalled();
      });

      it("returns 400 for malformed JSON", async () => {
        const response = await handle(new Request("http://localhost/api/admin/curriculum/lessons", { method, body: "{" }));
        expect(response.status).toBe(400);
        expect(writeMock).not.toHaveBeenCalled();
      });

      it.each([
        ["title", null], ["title", 1], ["title", "  "],
        ["description", 12], ["description", {}], ["description", []],
        ["sortOrder", "1"], ["sortOrder", null], ["sortOrder", 0], ["sortOrder", -1], ["sortOrder", 1.5], ["sortOrder", 2147483648],
      ])("returns 400 for invalid %s = %j", async (field, value) => {
        const response = await send({ ...bodyFor(), [field as string]: value });
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.success).toBe(false);
        expect(body.message).toMatch(/[\u0600-\u06FF]/);
        expect(writeMock).not.toHaveBeenCalled();
      });

      it("rejects missing required fields", async () => {
        const response = await send(method === "POST" ? { unitId: "unit-1" } : {});
        expect(response.status).toBe(400);
        expect(writeMock).not.toHaveBeenCalled();
      });

      it.each([
        { error: new AuthenticationRequiredError(), status: 401 },
        { error: new AuthorizationDeniedError(), status: 403 },
      ])("returns $status before reading the body when authorization fails", async ({ error, status }) => {
        requireAdminMock.mockRejectedValue(error);
        const request = new Request("http://localhost/api/admin/curriculum/lessons", { method, body: "{" });
        const jsonSpy = vi.spyOn(request, "json");
        const response = await handle(request);
        expect(response.status).toBe(status);
        expect(jsonSpy).not.toHaveBeenCalled();
        expect(unitFindUniqueMock).not.toHaveBeenCalled();
        expect(lessonFindUniqueMock).not.toHaveBeenCalled();
        expect(writeMock).not.toHaveBeenCalled();
      });

      it("returns 404 for a missing unit", async () => {
        unitFindUniqueMock.mockResolvedValue(null);
        const response = await send(bodyFor());
        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({ success: false, message: "الوحدة المحددة غير موجودة." });
        expect(writeMock).not.toHaveBeenCalled();
      });

      it("returns 409 for P2002 with a clear Arabic conflict message", async () => {
        writeMock.mockRejectedValue(errorFor("P2002"));
        const response = await send(bodyFor());
        expect(response.status).toBe(409);
        expect(await response.json()).toEqual({ success: false, message: "يوجد درس بهذا الترتيب في الوحدة نفسها. اختاري رقم ترتيب آخر." });
      });

      it("returns 404 if the unit disappears during the write", async () => {
        writeMock.mockRejectedValue(errorFor("P2003"));
        expect((await send(bodyFor())).status).toBe(404);
      });

      it("keeps unexpected database errors private", async () => {
        const logSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
        try {
          writeMock.mockRejectedValue(new Error("Sensitive database details"));
          const response = await send(bodyFor());
          expect(response.status).toBe(500);
          expect(await response.json()).toEqual({ success: false, message: "حدث خطأ غير متوقع أثناء حفظ الدرس." });
        } finally {
          logSpy.mockRestore();
        }
      });
    });
  }

  it.each([null, 1, "  "])("POST rejects invalid unitId %j", async (unitId) => {
    const response = await POST(new Request("http://localhost/api/admin/curriculum/lessons", { method: "POST", body: JSON.stringify({ ...input, unitId }) }));
    expect(response.status).toBe(400);
    expect(lessonCreateMock).not.toHaveBeenCalled();
  });

  it("PATCH returns 404 when the lesson does not exist", async () => {
    lessonFindUniqueMock.mockResolvedValue(null);
    const response = await PATCH(new Request("http://localhost/api/admin/curriculum/lessons/lesson-1", { method: "PATCH", body: JSON.stringify(input) }), context());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ success: false, message: "الدرس غير موجود." });
    expect(lessonUpdateMock).not.toHaveBeenCalled();
  });

  it("PATCH returns 404 if the lesson disappears during the update", async () => {
    lessonUpdateMock.mockRejectedValue(errorFor("P2025"));
    const response = await PATCH(new Request("http://localhost/api/admin/curriculum/lessons/lesson-1", { method: "PATCH", body: JSON.stringify(input) }), context());
    expect(response.status).toBe(404);
  });

  it("PATCH rejects moving a lesson to another unit", async () => {
    const response = await PATCH(new Request("http://localhost/api/admin/curriculum/lessons/lesson-1", { method: "PATCH", body: JSON.stringify({ ...input, unitId: "unit-2" }) }), context());
    expect(response.status).toBe(400);
    expect(lessonUpdateMock).not.toHaveBeenCalled();
  });
});
