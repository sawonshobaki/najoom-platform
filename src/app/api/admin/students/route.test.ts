import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireAdminMock,
  createStudentMock,
  deleteStudentMock,
  setStudentActiveStateMock,
} = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  createStudentMock: vi.fn(),
  deleteStudentMock: vi.fn(),
  setStudentActiveStateMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));

vi.mock("@/lib/auth/authorization", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/auth/authorization")>(),
  requireAdmin: requireAdminMock,
}));

vi.mock("@/lib/students/student-service", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/students/student-service")>(),
  createStudent: createStudentMock,
  deleteStudent: deleteStudentMock,
  setStudentActiveState: setStudentActiveStateMock,
}));

import { StudentServiceError } from "@/lib/students/student-service";
import { POST } from "./route";
import { DELETE } from "./[studentId]/route";
import { PATCH } from "./[studentId]/active/route";

const context = () => ({
  params: Promise.resolve({ studentId: "student-1" }),
});

function request(method: string, body: unknown) {
  return new NextRequest("http://localhost/api/admin/students", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("student API error handling", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAdminMock.mockResolvedValue(undefined);
  });

  describe("invalid JSON body shapes", () => {
    it.each([null, "text", 123, true, []])(
      "POST returns 400 for %j without creating a student",
      async (body) => {
        const response = await POST(request("POST", body));

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({
          success: false,
          message: "بيانات الطلب غير صالحة.",
        });
        expect(requireAdminMock).toHaveBeenCalledTimes(1);
        expect(createStudentMock).not.toHaveBeenCalled();
      },
    );

    it.each([null, "text", 123, true, []])(
      "PATCH returns 400 for %j without changing active state",
      async (body) => {
        const response = await PATCH(request("PATCH", body), context());

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({
          success: false,
          message: "بيانات الطلب غير صالحة.",
        });
        expect(requireAdminMock).toHaveBeenCalledTimes(1);
        expect(setStudentActiveStateMock).not.toHaveBeenCalled();
      },
    );
  });

  it("POST returns a clear 400 for a password policy rejection", async () => {
    createStudentMock.mockRejectedValue(
      new StudentServiceError("invalid_password"),
    );
    const response = await POST(request("POST", {
      fullName: "طالبة تجريبية",
      studentCode: "ST-001",
      username: "student-001",
      password: "password123",
      sectionId: "section-1",
    }));

    expect(createStudentMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      message: "كلمة المرور غير صالحة. يجب أن تتكون من 10 إلى 128 حرفًا وألا تكون من كلمات المرور الشائعة.",
    });
  });

  it("DELETE returns 409 for a student with restricted related data", async () => {
    deleteStudentMock.mockRejectedValue(
      new StudentServiceError("student_has_related_data"),
    );
    const response = await DELETE(
      new Request("http://localhost/api/admin/students/student-1", {
        method: "DELETE",
      }),
      context(),
    );

    expect(deleteStudentMock).toHaveBeenCalledWith("student-1");
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      success: false,
      message: "لدى الطالبة بيانات مرتبطة، ولا يمكن حذفها حاليًا.",
    });
  });
});
