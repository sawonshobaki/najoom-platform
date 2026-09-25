import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireStudentMock,
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
    requireStudentMock: vi.fn(),
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
  requireStudent: requireStudentMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import StudentLayout from "./layout";

const REDIRECT_ERROR_MESSAGE = "NEXT_REDIRECT_TEST";

describe("StudentLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    redirectMock.mockImplementation(() => {
      throw new Error(REDIRECT_ERROR_MESSAGE);
    });
  });

  it("renders children when the current user is a student", async () => {
    requireStudentMock.mockResolvedValue({
      id: "student-user",
    });

    const children = <div>Student content</div>;

    const result = await StudentLayout({
      children,
    });

    expect(result).toEqual(children);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated users to login", async () => {
    requireStudentMock.mockRejectedValue(
      new AuthenticationRequiredErrorMock(),
    );

    await expect(
      StudentLayout({
        children: <div>Student content</div>,
      }),
    ).rejects.toThrow(REDIRECT_ERROR_MESSAGE);

    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("redirects authenticated users with the wrong role to dashboard", async () => {
    requireStudentMock.mockRejectedValue(
      new AuthorizationDeniedErrorMock(),
    );

    await expect(
      StudentLayout({
        children: <div>Student content</div>,
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

    requireStudentMock.mockRejectedValue(
      unexpectedError,
    );

    await expect(
      StudentLayout({
        children: <div>Student content</div>,
      }),
    ).rejects.toBe(unexpectedError);

    expect(redirectMock).not.toHaveBeenCalled();
  });
});
