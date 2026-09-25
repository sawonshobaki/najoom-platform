import { beforeEach, describe, expect, it, vi } from "vitest";

const { endCurrentSessionMock } = vi.hoisted(() => ({
  endCurrentSessionMock: vi.fn(),
}));

vi.mock("@/lib/auth/auth-session", () => ({
  endCurrentSession: endCurrentSessionMock,
}));

import { POST } from "./route";

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ends the current session and returns success", async () => {
    endCurrentSessionMock.mockResolvedValue(undefined);

    const response = await POST();

    expect(endCurrentSessionMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body).toEqual({
      success: true,
    });
  });

  it("does not expose session details", async () => {
    endCurrentSessionMock.mockResolvedValue(undefined);

    const response = await POST();
    const body = await response.json();

    expect(body.sessionId).toBeUndefined();
    expect(body.token).toBeUndefined();
    expect(body.userId).toBeUndefined();
  });
});
