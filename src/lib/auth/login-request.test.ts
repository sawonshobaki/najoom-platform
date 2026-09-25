import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginThrottleScope } from "@/generated/prisma/client";

const {
  clearLoginThrottleMock,
  getLoginThrottleStatusMock,
  loginWithUsernameAndPasswordMock,
  recordFailedLoginAttemptMock,
} = vi.hoisted(() => ({
  clearLoginThrottleMock: vi.fn(),
  getLoginThrottleStatusMock: vi.fn(),
  loginWithUsernameAndPasswordMock: vi.fn(),
  recordFailedLoginAttemptMock: vi.fn(),
}));

vi.mock("@/lib/auth/login-throttle", () => ({
  clearLoginThrottle: clearLoginThrottleMock,
  getLoginThrottleStatus: getLoginThrottleStatusMock,
  recordFailedLoginAttempt: recordFailedLoginAttemptMock,
}));

vi.mock("@/lib/auth/login-service", () => ({
  INVALID_LOGIN_MESSAGE: "بيانات الدخول غير صحيحة.",
  loginWithUsernameAndPassword:
    loginWithUsernameAndPasswordMock,
}));

import { loginFromRequest } from "@/lib/auth/login-request";

describe("login request orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getLoginThrottleStatusMock.mockResolvedValue({
      blocked: false,
      retryAfterSeconds: 0,
    });
  });

  it("falls back to username-only protection when networkKey is missing", async () => {
    loginWithUsernameAndPasswordMock.mockResolvedValue({
      success: false,
      message: "بيانات الدخول غير صحيحة.",
    });

    const result = await loginFromRequest({
      username: "student-001",
      password: "WrongPassword2026",
    });

    expect(result).toEqual({
      success: false,
      message: "بيانات الدخول غير صحيحة.",
    });

    expect(
      loginWithUsernameAndPasswordMock,
    ).toHaveBeenCalledWith(
      "student-001",
      "WrongPassword2026",
    );

    expect(
      getLoginThrottleStatusMock,
    ).not.toHaveBeenCalled();

    expect(
      recordFailedLoginAttemptMock,
    ).not.toHaveBeenCalled();
  });

  it("normalizes username before login", async () => {
    loginWithUsernameAndPasswordMock.mockResolvedValue({
      success: false,
      message: "بيانات الدخول غير صحيحة.",
    });

    await loginFromRequest({
      username: "  student-001  ",
      password: "WrongPassword2026",
    });

    expect(
      loginWithUsernameAndPasswordMock,
    ).toHaveBeenCalledWith(
      "student-001",
      "WrongPassword2026",
    );
  });

  it("blocks before password verification when the network is throttled", async () => {
    getLoginThrottleStatusMock
      .mockResolvedValueOnce({
        blocked: true,
        retryAfterSeconds: 120,
      })
      .mockResolvedValueOnce({
        blocked: false,
        retryAfterSeconds: 0,
      });

    const result = await loginFromRequest({
      username: "student-001",
      password: "WrongPassword2026",
      networkKey: "school-network",
    });

    expect(result).toEqual({
      success: false,
      message: "بيانات الدخول غير صحيحة.",
      retryAfterSeconds: 120,
    });

    expect(
      loginWithUsernameAndPasswordMock,
    ).not.toHaveBeenCalled();
  });

  it("blocks when the username-network combination is throttled", async () => {
    getLoginThrottleStatusMock
      .mockResolvedValueOnce({
        blocked: false,
        retryAfterSeconds: 0,
      })
      .mockResolvedValueOnce({
        blocked: true,
        retryAfterSeconds: 90,
      });

    const result = await loginFromRequest({
      username: "student-001",
      password: "WrongPassword2026",
      networkKey: "school-network",
    });

    expect(result).toEqual({
      success: false,
      message: "بيانات الدخول غير صحيحة.",
      retryAfterSeconds: 90,
    });

    expect(
      loginWithUsernameAndPasswordMock,
    ).not.toHaveBeenCalled();
  });

  it("uses the longest retry time when multiple scopes are blocked", async () => {
    getLoginThrottleStatusMock
      .mockResolvedValueOnce({
        blocked: true,
        retryAfterSeconds: 60,
      })
      .mockResolvedValueOnce({
        blocked: true,
        retryAfterSeconds: 180,
      });

    const result = await loginFromRequest({
      username: "student-001",
      password: "WrongPassword2026",
      networkKey: "school-network",
    });

    expect(result).toEqual({
      success: false,
      message: "بيانات الدخول غير صحيحة.",
      retryAfterSeconds: 180,
    });
  });

  it("records network throttles after a failed login", async () => {
    loginWithUsernameAndPasswordMock.mockResolvedValue({
      success: false,
      message: "بيانات الدخول غير صحيحة.",
    });

    const result = await loginFromRequest({
      username: "student-001",
      password: "WrongPassword2026",
      networkKey: "school-network",
    });

    expect(result).toEqual({
      success: false,
      message: "بيانات الدخول غير صحيحة.",
    });

    expect(
      recordFailedLoginAttemptMock,
    ).toHaveBeenCalledTimes(2);

    expect(
      recordFailedLoginAttemptMock,
    ).toHaveBeenCalledWith(
      LoginThrottleScope.NETWORK,
      "school-network",
    );

    expect(
      recordFailedLoginAttemptMock,
    ).toHaveBeenCalledWith(
      LoginThrottleScope.USERNAME_NETWORK,
      "student-001:school-network",
    );
  });

  it("clears only the username-network throttle after a successful login", async () => {
    loginWithUsernameAndPasswordMock.mockResolvedValue({
      success: true,
      userId: "user-1",
    });

    const result = await loginFromRequest({
      username: "student-001",
      password: "ValidPassword2026",
      networkKey: "school-network",
    });

    expect(result).toEqual({
      success: true,
      userId: "user-1",
    });

    expect(
      clearLoginThrottleMock,
    ).toHaveBeenCalledTimes(1);

    expect(
      clearLoginThrottleMock,
    ).toHaveBeenCalledWith(
      LoginThrottleScope.USERNAME_NETWORK,
      "student-001:school-network",
    );

    expect(
      clearLoginThrottleMock,
    ).not.toHaveBeenCalledWith(
      LoginThrottleScope.NETWORK,
      "school-network",
    );
  });

  it("does not create network throttles when the networkKey is blank", async () => {
    loginWithUsernameAndPasswordMock.mockResolvedValue({
      success: false,
      message: "بيانات الدخول غير صحيحة.",
    });

    await loginFromRequest({
      username: "student-001",
      password: "WrongPassword2026",
      networkKey: "   ",
    });

    expect(
      getLoginThrottleStatusMock,
    ).not.toHaveBeenCalled();

    expect(
      recordFailedLoginAttemptMock,
    ).not.toHaveBeenCalled();

    expect(
      clearLoginThrottleMock,
    ).not.toHaveBeenCalled();

    expect(
      loginWithUsernameAndPasswordMock,
    ).toHaveBeenCalledWith(
      "student-001",
      "WrongPassword2026",
    );
  });
});
