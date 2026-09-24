import { describe, expect, it } from "vitest";

import {
  hashPassword,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  validatePasswordPolicy,
  verifyPassword,
} from "./password";

describe("password security utilities", () => {
  it("rejects passwords that are too short", () => {
    const password = "a".repeat(MIN_PASSWORD_LENGTH - 1);

    expect(validatePasswordPolicy(password)).toEqual({
      valid: false,
      reason: "too_short",
    });
  });

  it("rejects passwords that are too long", () => {
    const password = "a".repeat(MAX_PASSWORD_LENGTH + 1);

    expect(validatePasswordPolicy(password)).toEqual({
      valid: false,
      reason: "too_long",
    });
  });

  it("rejects very common passwords", () => {
    expect(
      validatePasswordPolicy("password123"),
    ).toEqual({
      valid: false,
      reason: "too_common",
    });
  });

  it("accepts a sufficiently strong password", () => {
    expect(
      validatePasswordPolicy("NajoomScience2026"),
    ).toEqual({
      valid: true,
    });
  });

  it("creates an Argon2id hash", async () => {
    const password = "NajoomScience2026";
    const passwordHash = await hashPassword(password);

    expect(passwordHash).not.toBe(password);
    expect(passwordHash.startsWith("$argon2id$")).toBe(true);
  });

  it("verifies the correct password", async () => {
    const password = "NajoomScience2026";
    const passwordHash = await hashPassword(password);

    await expect(
      verifyPassword(passwordHash, password),
    ).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const passwordHash = await hashPassword(
      "NajoomScience2026",
    );

    await expect(
      verifyPassword(
        passwordHash,
        "WrongPassword2026",
      ),
    ).resolves.toBe(false);
  });

  it("returns false for a malformed hash", async () => {
    await expect(
      verifyPassword(
        "not-a-valid-argon2-hash",
        "NajoomScience2026",
      ),
    ).resolves.toBe(false);
  });

  it("refuses to hash a password that violates policy", async () => {
    await expect(
      hashPassword("123"),
    ).rejects.toThrow(
      "Password does not meet policy",
    );
  });
});
