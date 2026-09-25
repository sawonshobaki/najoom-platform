import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireAdminMock,
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
    requireAdminMock: vi.fn(),
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
  requireAdmin: requireAdminMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import AdminLayout from "./layout";

const REDIRECT_ERROR_MESSAGE = "NEXT_REDIRECT_TEST";

describe("AdminLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    redirectMock.mockImplementation(() => {
      throw new Error(REDIRECT_ERROR_MESSAGE);
    });
  });

  it("renders children when the current user is an admin", async () => {
    requireAdminMock.mockResolvedValue({
      id: "admin-user",
    });

    const children = <div>Admin content</div>;

    const result = await AdminLayout({
      children,
    });

    expect(result).toEqual(children);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated users to login", async () => {
    requireAdminMock.mockRejectedValue(
      new AuthenticationRequiredErrorMock(),
    );

    await expect(
      AdminLayout({
        children: <div>Admin content</div>,
      }),
    ).rejects.toThrow(REDIRECT_ERROR_MESSAGE);

    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("redirects authenticated users with the wrong role to dashboard", async () => {
    requireAdminMock.mockRejectedValue(
      new AuthorizationDeniedErrorMock(),
    );

    await expect(
      AdminLayout({
        children: <div>Admin content</div>,
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

    requireAdminMock.mockRejectedValue(
      unexpectedError,
    );

    await expect(
      AdminLayout({
        children: <div>Admin content</div>,
      }),
    ).rejects.toBe(unexpectedError);

    expect(redirectMock).not.toHaveBeenCalled();
  });
});