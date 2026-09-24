import { beforeEach, describe, expect, it, vi } from "vitest";

const { loginFromRequestMock } = vi.hoisted(() => ({
  loginFromRequestMock: vi.fn(),
}));

vi.mock("@/lib/auth/login-request", () => ({
  loginFromRequest: loginFromRequestMock,
}));

import { POST } from "./route";

function createRequest(body: unknown): Request {
  return new Request(
    "http://localhost/api/auth/login",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for an invalid request body", async () => {
    const response = await POST(
      createRequest({
        username: 123,
        password: "test",
      }) as never,
    );

    expect(response.status).toBe(400);

    const body = await response.json();

    expect(body).toEqual({
      success: false,
      message: "بيانات الدخول غير صحيحة.",
    });

    expect(
      loginFromRequestMock,
    ).not.toHaveBeenCalled();
  });

  it("returns 400 for empty username", async () => {
    const response = await POST(
      createRequest({
        username: "",
        password: "NajoomScience2026",
      }) as never,
    );

    expect(response.status).toBe(400);

    expect(
      loginFromRequestMock,
    ).not.toHaveBeenCalled();
  });

  it("returns 401 when login credentials are invalid", async () => {
    loginFromRequestMock.mockResolvedValue({
      success: false,
      message: "بيانات الدخول غير صحيحة.",
    });

    const response = await POST(
      createRequest({
        username: "student-001",
        password: "WrongPassword2026",
      }) as never,
    );

    expect(response.status).toBe(401);

    const body = await response.json();

    expect(body).toEqual({
      success: false,
      message: "بيانات الدخول غير صحيحة.",
    });
  });

  it("returns 429 with Retry-After when throttled", async () => {
    loginFromRequestMock.mockResolvedValue({
      success: false,
      message: "بيانات الدخول غير صحيحة.",
      retryAfterSeconds: 120,
    });

    const response = await POST(
      createRequest({
        username: "student-001",
        password: "WrongPassword2026",
      }) as never,
    );

    expect(response.status).toBe(429);

    expect(
      response.headers.get("Retry-After"),
    ).toBe("120");

    const body = await response.json();

    expect(body).toEqual({
      success: false,
      message: "بيانات الدخول غير صحيحة.",
    });
  });

  it("returns 200 for a successful login", async () => {
    loginFromRequestMock.mockResolvedValue({
      success: true,
      userId: "user-1",
    });

    const response = await POST(
      createRequest({
        username: "student-001",
        password: "NajoomScience2026",
      }) as never,
    );

    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body).toEqual({
      success: true,
    });
  });

  it("does not expose userId in a successful response", async () => {
    loginFromRequestMock.mockResolvedValue({
      success: true,
      userId: "sensitive-user-id",
    });

    const response = await POST(
      createRequest({
        username: "student-001",
        password: "NajoomScience2026",
      }) as never,
    );

    const body = await response.json();

    expect(body.userId).toBeUndefined();
  });
});
