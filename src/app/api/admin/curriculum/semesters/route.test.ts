import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const {
  requireAdminMock, gradeFindUniqueMock, semesterFindUniqueMock, semesterCreateMock, semesterUpdateMock,
} = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  gradeFindUniqueMock: vi.fn(),
  semesterFindUniqueMock: vi.fn(),
  semesterCreateMock: vi.fn(),
  semesterUpdateMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    grade: { findUnique: gradeFindUniqueMock },
    semester: { findUnique: semesterFindUniqueMock, create: semesterCreateMock, update: semesterUpdateMock },
  },
}));
vi.mock("@/lib/auth/authorization", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/auth/authorization")>(),
  requireAdmin: requireAdminMock,
}));

import { AuthenticationRequiredError, AuthorizationDeniedError } from "@/lib/auth/authorization";
import { POST } from "./route";
import { PATCH } from "./[semesterId]/route";

const input = { name: "الفصل الأول", academicYear: "2026-2027", sortOrder: 1 };
const semester = { id: "semester-1", gradeId: "grade-1", ...input };

describe("semester APIs", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAdminMock.mockResolvedValue(undefined);
    gradeFindUniqueMock.mockResolvedValue({ id: "grade-1" });
    semesterFindUniqueMock.mockResolvedValue({ gradeId: "grade-1" });
    semesterCreateMock.mockResolvedValue(semester);
    semesterUpdateMock.mockResolvedValue(semester);
  });

  for (const method of ["POST", "PATCH"] as const) {
    describe(method, () => {
      const bodyFor = (fields = input) => method === "POST" ? { gradeId: "grade-1", ...fields } : fields;
      const send = (body: unknown) => handle(new Request("http://localhost/api/admin/curriculum/semesters", {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      }));
      const handle = (request: Request) => method === "POST" ? POST(request)
        : PATCH(request, { params: Promise.resolve({ semesterId: "semester-1" }) });
      const writeMock = method === "POST" ? semesterCreateMock : semesterUpdateMock;

      it("saves valid semester fields", async () => {
        const response = await send(bodyFor());
        expect(response.status).toBe(method === "POST" ? 201 : 200);
        expect(await response.json()).toEqual({ success: true, semester });
        expect(requireAdminMock).toHaveBeenCalled();
        expect(writeMock).toHaveBeenCalledTimes(1);
      });

      it.each([null, [], "text", 12, true])("returns 400 for body %j", async (body) => {
        const response = await send(body);
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ success: false, message: "بيانات الطلب غير صالحة." });
        expect(writeMock).not.toHaveBeenCalled();
      });

      it("returns 400 for malformed JSON", async () => {
        const response = await handle(new Request("http://localhost/api/admin/curriculum/semesters", { method, body: "{" }));
        expect(response.status).toBe(400);
        expect(writeMock).not.toHaveBeenCalled();
      });

      it.each([
        ["name", null], ["name", 1], ["name", "   "],
        ["academicYear", null], ["academicYear", 2026], ["academicYear", "2026/2027"], ["academicYear", "2026-2028"],
        ["sortOrder", "1"], ["sortOrder", null], ["sortOrder", 0], ["sortOrder", -1], ["sortOrder", 1.5],
      ])("returns 400 for invalid %s = %j", async (field, value) => {
        const response = await send({ ...bodyFor(), [field as string]: value });
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.success).toBe(false);
        expect(body.message).toMatch(/[\u0600-\u06FF]/);
        expect(writeMock).not.toHaveBeenCalled();
      });

      it("rejects missing required fields", async () => {
        const response = await send(method === "POST" ? { gradeId: "grade-1" } : {});
        expect(response.status).toBe(400);
        expect(writeMock).not.toHaveBeenCalled();
      });

      it.each([
        { error: new AuthenticationRequiredError(), status: 401 },
        { error: new AuthorizationDeniedError(), status: 403 },
      ])("returns $status before parsing the body when authorization fails", async ({ error, status }) => {
        requireAdminMock.mockRejectedValue(error);
        const request = new Request("http://localhost/api/admin/curriculum/semesters", { method, body: "{" });
        const jsonSpy = vi.spyOn(request, "json");
        const response = await handle(request);
        expect(response.status).toBe(status);
        expect(jsonSpy).not.toHaveBeenCalled();
        expect(gradeFindUniqueMock).not.toHaveBeenCalled();
        expect(semesterFindUniqueMock).not.toHaveBeenCalled();
        expect(writeMock).not.toHaveBeenCalled();
      });

      it("returns a clear 409 when Prisma reports P2002", async () => {
        writeMock.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("Unique constraint", {
          code: "P2002", clientVersion: "7.10.0", meta: { target: ["gradeId", "academicYear", "sortOrder"] },
        }));
        const response = await send(bodyFor());
        expect(response.status).toBe(409);
        expect(await response.json()).toEqual({
          success: false,
          message: "يوجد فصل دراسي بهذا الترتيب في الصف والسنة الدراسية نفسيهما. اختاري رقم ترتيب آخر.",
        });
      });

      it("returns 404 for a missing grade", async () => {
        gradeFindUniqueMock.mockResolvedValue(null);
        const response = await send(bodyFor());
        expect(response.status).toBe(404);
        expect(writeMock).not.toHaveBeenCalled();
      });

      it("keeps unexpected errors private", async () => {
        const logSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
        try {
          writeMock.mockRejectedValue(new Error("Sensitive database details"));
          const response = await send(bodyFor());
          expect(response.status).toBe(500);
          expect(await response.json()).toEqual({ success: false, message: "حدث خطأ غير متوقع أثناء حفظ الفصل الدراسي." });
        } finally {
          logSpy.mockRestore();
        }
      });
    });
  }

  it.each([null, 1, "   "])("POST rejects invalid gradeId %j", async (gradeId) => {
    const response = await POST(new Request("http://localhost/api/admin/curriculum/semesters", {
      method: "POST", body: JSON.stringify({ ...input, gradeId }),
    }));
    expect(response.status).toBe(400);
    expect(semesterCreateMock).not.toHaveBeenCalled();
  });

  it("PATCH returns 404 when the semester does not exist", async () => {
    semesterFindUniqueMock.mockResolvedValue(null);
    const response = await PATCH(new Request("http://localhost/api/admin/curriculum/semesters/semester-1", {
      method: "PATCH", body: JSON.stringify(input),
    }), { params: Promise.resolve({ semesterId: "semester-1" }) });
    expect(response.status).toBe(404);
    expect(semesterUpdateMock).not.toHaveBeenCalled();
  });

  it("PATCH rejects grade changes", async () => {
    const response = await PATCH(new Request("http://localhost/api/admin/curriculum/semesters/semester-1", {
      method: "PATCH", body: JSON.stringify({ ...input, gradeId: "grade-2" }),
    }), { params: Promise.resolve({ semesterId: "semester-1" }) });
    expect(response.status).toBe(400);
    expect(semesterUpdateMock).not.toHaveBeenCalled();
  });
});
