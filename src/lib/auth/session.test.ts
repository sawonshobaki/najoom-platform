import { describe, expect, it } from "vitest";

import {
  generateSessionToken,
  getSessionExpirationDate,
  hashSessionToken,
  isSessionExpired,
  SESSION_DURATION_DAYS,
}from "./session";

describe("session security utilities", () => {
  it("generates different session tokens", () => {
    const firstToken = generateSessionToken();
    const secondToken = generateSessionToken();

    expect(firstToken).not.toBe(secondToken);
  });

  it("generates sufficiently long session tokens", () => {
    const sessionToken = generateSessionToken();

    /**
     * randomBytes(32) with base64url encoding
     * ينتج عادة رمزًا بطول يقارب 43 حرفًا.
     *
     * لا نعتمد على طول دقيق جدًا حتى لا نجعل الاختبار هشًا،
     * لكن نتحقق أن الطول قوي بما يكفي.
     */
    expect(sessionToken.length).toBeGreaterThanOrEqual(40);
  });

  it("hashes the same token consistently", () => {
    const sessionToken = generateSessionToken();

    const firstHash = hashSessionToken(sessionToken);
    const secondHash = hashSessionToken(sessionToken);

    expect(firstHash).toBe(secondHash);
  });

  it("does not return the raw token as the hash", () => {
    const sessionToken = generateSessionToken();
    const tokenHash = hashSessionToken(sessionToken);

    expect(tokenHash).not.toBe(sessionToken);
  });

  it("creates a 64-character SHA-256 hex hash", () => {
    const sessionToken = generateSessionToken();
    const tokenHash = hashSessionToken(sessionToken);

    expect(tokenHash).toHaveLength(64);
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("creates an expiration date using the configured session duration", () => {
    const now = new Date("2026-09-24T10:00:00.000Z");

    const expiresAt = getSessionExpirationDate(now);

    const expectedExpiration = new Date(
      now.getTime() +
        SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000,
    );

    expect(expiresAt.getTime()).toBe(
      expectedExpiration.getTime(),
    );
  });

  it("marks past sessions as expired", () => {
    const now = new Date("2026-09-24T10:00:00.000Z");
    const expiresAt = new Date("2026-09-24T09:59:59.000Z");

    expect(isSessionExpired(expiresAt, now)).toBe(true);
  });

  it("marks sessions expiring now as expired", () => {
    const now = new Date("2026-09-24T10:00:00.000Z");

    expect(isSessionExpired(now, now)).toBe(true);
  });

  it("keeps future sessions valid", () => {
    const now = new Date("2026-09-24T10:00:00.000Z");
    const expiresAt = new Date("2026-09-24T10:00:01.000Z");

    expect(isSessionExpired(expiresAt, now)).toBe(false);
  });
});