import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireTeacherMock,
  redirectMock,
  AuthenticationRequiredErrorMock,
  AuthorizationDeniedErrorMock,
} = vi.hoisted(() => {
  class AuthenticationRequiredError extends Error {
    constructor() {
      super("Authentication required.");
      this.name = "AuthenticationRequiredError";
    }
  }

  class AuthorizationDeniedError extends Error {
    constructor() {
      super("Authorization denied.");
      this.name = "AuthorizationDeniedError";
    }
  }

  return {
    requireTeacherMock: vi.fn(),
    redirectMock: vi.fn(),
    AuthenticationRequiredErrorMock:
      AuthenticationRequiredError,
    AuthorizationDeniedErrorMock:
      AuthorizationDeniedError,
  };
});

vi.mock("@/lib/auth/authorization", () => ({
  AuthenticationRequiredError:
    AuthenticationRequiredErrorMock,
  AuthorizationDeniedError:
    AuthorizationDeniedErrorMock,
  requireTeacher: requireTeacherMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import TeacherLayout from "./layout";

const REDIRECT_ERROR_MESSAGE = "NEXT_REDIRECT_TEST";

describe("TeacherLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    redirectMock.mockImplementation(() => {
      throw new Error(REDIRECT_ERROR_MESSAGE);
    });
  });

  it("renders children when the current user is a teacher", async () => {
    requireTeacherMock.mockResolvedValue({
      id: "teacher-user",
    });

    const children = <div>Teacher content</div>;

    const result = await TeacherLayout({
      children,
    });

    expect(result).toEqual(children);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated users to login", async () => {
    requireTeacherMock.mockRejectedValue(
      new AuthenticationRequiredErrorMock(),
    );

    await expect(
      TeacherLayout({
        children: <div>Teacher content</div>,
      }),
    ).rejects.toThrow(REDIRECT_ERROR_MESSAGE);

    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("redirects authenticated users with the wrong role to dashboard", async () => {
    requireTeacherMock.mockRejectedValue(
      new AuthorizationDeniedErrorMock(),
    );

    await expect(
      TeacherLayout({
        children: <div>Teacher content</div>,
      }),
    ).rejects.toThrow(REDIRECT_ERROR_MESSAGE);

    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith(
      "/dashboard",
    );
  });

  it("rethrows unexpected errors", async () => {
    const unexpectedError =
      new Error("Unexpected failure");

    requireTeacherMock.mockRejectedValue(
      unexpectedError,
    );

    await expect(
      TeacherLayout({
        children: <div>Teacher content</div>,
      }),
    ).rejects.toBe(unexpectedError);

    expect(redirectMock).not.toHaveBeenCalled();
  });
});
