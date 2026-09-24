import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginThrottleScope } from "@/generated/prisma/client";

const {
  findUniqueMock,
  createMock,
  updateMock,
  deleteManyMock,
} = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  createMock: vi.fn(),
  updateMock: vi.fn(),
  deleteManyMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    loginThrottle: {
      findUnique: findUniqueMock,
      create: createMock,
      update: updateMock,
      deleteMany: deleteManyMock,
    },
  },
}));

import {
  clearLoginThrottle,
  getLoginThrottleStatus,
  hashThrottleIdentifier,
  recordFailedLoginAttempt,
} from "@/lib/auth/login-throttle";

describe("login throttling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hashes identifiers consistently", () => {
    const firstHash =
      hashThrottleIdentifier("student-001");

    const secondHash =
      hashThrottleIdentifier("student-001");

    expect(firstHash).toBe(secondHash);
    expect(firstHash).toHaveLength(64);
  });

  it("does not expose the raw identifier in the hash", () => {
    const identifier = "student-001";

    const identifierHash =
      hashThrottleIdentifier(identifier);

    expect(identifierHash).not.toBe(identifier);
    expect(identifierHash).not.toContain(identifier);
  });

  it("returns unblocked when no throttle record exists", async () => {
    findUniqueMock.mockResolvedValue(null);

    const result = await getLoginThrottleStatus(
      LoginThrottleScope.USERNAME,
      "student-001",
    );

    expect(result).toEqual({
      blocked: false,
      retryAfterSeconds: 0,
    });
  });

  it("returns unblocked when block has expired", async () => {
    findUniqueMock.mockResolvedValue({
      blockedUntil: new Date(Date.now() - 10_000),
    });

    const result = await getLoginThrottleStatus(
      LoginThrottleScope.USERNAME,
      "student-001",
    );

    expect(result).toEqual({
      blocked: false,
      retryAfterSeconds: 0,
    });
  });

  it("returns blocked when block is still active", async () => {
    findUniqueMock.mockResolvedValue({
      blockedUntil: new Date(Date.now() + 60_000),
    });

    const result = await getLoginThrottleStatus(
      LoginThrottleScope.USERNAME,
      "student-001",
    );

    expect(result.blocked).toBe(true);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("creates a new throttle record after the first failed attempt", async () => {
    findUniqueMock.mockResolvedValue(null);

    await recordFailedLoginAttempt(
      LoginThrottleScope.USERNAME,
      "student-001",
    );

    expect(createMock).toHaveBeenCalledOnce();

    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        scope: LoginThrottleScope.USERNAME,
        failureCount: 1,
      }),
    });
  });

  it("increments the failure count inside the active window", async () => {
    findUniqueMock.mockResolvedValue({
      id: "throttle-1",
      failureCount: 2,
      windowStartedAt: new Date(),
    });

    await recordFailedLoginAttempt(
      LoginThrottleScope.USERNAME,
      "student-001",
    );

    expect(updateMock).toHaveBeenCalledWith({
      where: {
        id: "throttle-1",
      },
      data: expect.objectContaining({
        failureCount: 3,
      }),
    });
  });

  it("resets the failure count when the previous window expired", async () => {
    findUniqueMock.mockResolvedValue({
      id: "throttle-1",
      failureCount: 8,
      windowStartedAt: new Date(
        Date.now() - 60 * 60 * 1000,
      ),
    });

    await recordFailedLoginAttempt(
      LoginThrottleScope.USERNAME,
      "student-001",
    );

    expect(updateMock).toHaveBeenCalledWith({
      where: {
        id: "throttle-1",
      },
      data: expect.objectContaining({
        failureCount: 1,
        blockedUntil: null,
      }),
    });
  });

  it("starts a temporary block when the failure limit is reached", async () => {
    findUniqueMock.mockResolvedValue({
      id: "throttle-1",
      failureCount: 4,
      windowStartedAt: new Date(),
    });

    await recordFailedLoginAttempt(
      LoginThrottleScope.USERNAME,
      "student-001",
    );

    expect(updateMock).toHaveBeenCalledOnce();

    const updateCall =
      updateMock.mock.calls[0][0];

    expect(updateCall.data.failureCount).toBe(5);
    expect(updateCall.data.blockedUntil).toBeInstanceOf(
      Date,
    );
  });

  it("clears throttle state after a successful login", async () => {
    deleteManyMock.mockResolvedValue({
      count: 1,
    });

    await clearLoginThrottle(
      LoginThrottleScope.USERNAME,
      "student-001",
    );

    expect(deleteManyMock).toHaveBeenCalledOnce();

    expect(deleteManyMock).toHaveBeenCalledWith({
      where: {
        scope: LoginThrottleScope.USERNAME,
        identifierHash: expect.any(String),
      },
    });
  });
});