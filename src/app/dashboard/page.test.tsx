import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserRole } from "@/generated/prisma/client";

const {
  getCurrentUserMock,
  redirectMock,
} = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("@/lib/auth/auth-session", () => ({
  getCurrentUser: getCurrentUserMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import DashboardPage from "./page";

const REDIRECT_ERROR_MESSAGE = "NEXT_REDIRECT_TEST";

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    /**
     * Next.js redirect() يوقف التنفيذ ولا يعود إلى السطر التالي.
     * نحاكي هذا السلوك في الاختبار برمي خطأ معروف.
     */
    redirectMock.mockImplementation(() => {
      throw new Error(REDIRECT_ERROR_MESSAGE);
    });
  });

  it("redirects unauthenticated users to login", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    await expect(
      DashboardPage(),
    ).rejects.toThrow(REDIRECT_ERROR_MESSAGE);

    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("redirects students to the student area", async () => {
    getCurrentUserMock.mockResolvedValue({
      id: "user-student",
      role: UserRole.STUDENT,
    });

    await expect(
      DashboardPage(),
    ).rejects.toThrow(REDIRECT_ERROR_MESSAGE);

    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith("/student");
  });

  it("redirects teachers to the teacher area", async () => {
    getCurrentUserMock.mockResolvedValue({
      id: "user-teacher",
      role: UserRole.TEACHER,
    });

    await expect(
      DashboardPage(),
    ).rejects.toThrow(REDIRECT_ERROR_MESSAGE);

    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith("/teacher");
  });

  it("redirects admins to the admin area", async () => {
    getCurrentUserMock.mockResolvedValue({
      id: "user-admin",
      role: UserRole.ADMIN,
    });

    await expect(
      DashboardPage(),
    ).rejects.toThrow(REDIRECT_ERROR_MESSAGE);

    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith("/admin");
  });
});