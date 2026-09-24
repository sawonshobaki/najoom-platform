import "server-only";

import * as argon2 from "argon2";

/**
 * أقل طول مسموح لكلمة المرور.
 */
export const MIN_PASSWORD_LENGTH = 10;

/**
 * حد أعلى لمنع مدخلات ضخمة أو إساءة استخدام.
 */
export const MAX_PASSWORD_LENGTH = 128;

/**
 * كلمات مرور شائعة جدًا لا نسمح بها.
 */
const VERY_COMMON_PASSWORDS = new Set([
  "1234567890",
  "password",
  "password123",
  "qwerty123",
  "1111111111",
  "0000000000",
]);

export type PasswordValidationResult =
  | {
      valid: true;
    }
  | {
      valid: false;
      reason:
        | "too_short"
        | "too_long"
        | "too_common";
    };

/**
 * يتحقق من سياسة كلمة المرور.
 */
export function validatePasswordPolicy(
  password: string,
): PasswordValidationResult {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      reason: "too_short",
    };
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return {
      valid: false,
      reason: "too_long",
    };
  }

  if (VERY_COMMON_PASSWORDS.has(password.toLowerCase())) {
    return {
      valid: false,
      reason: "too_common",
    };
  }

  return {
    valid: true,
  };
}

/**
 * ينشئ Password Hash باستخدام Argon2id.
 *
 * hashing يتم على الخادم فقط.
 */
export async function hashPassword(
  password: string,
): Promise<string> {
  const validation = validatePasswordPolicy(password);

  if (!validation.valid) {
    throw new Error(
      `Password does not meet policy: ${validation.reason}`,
    );
  }

  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
}

/**
 * يتحقق من أن كلمة المرور تطابق الـ hash المخزن.
 */
export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await argon2.verify(
      passwordHash,
      password,
    );
  } catch {
    return false;
  }
}
/**
 * كلمة مرور وهمية داخلية تستخدم فقط لمعادلة تكلفة
 * التحقق عندما يكون اسم المستخدم غير موجود.
 *
 * لا تمثل حسابًا حقيقيًا ولا تحفظ في قاعدة البيانات.
 */
const DUMMY_PASSWORD = "NajoomDummyPassword2026";

let dummyPasswordHashPromise: Promise<string> | null = null;

/**
 * ينشئ Dummy Password Hash مرة واحدة فقط لكل عملية تشغيل.
 *
 * الهدف تقليل فرق التوقيت بين:
 * - اسم مستخدم غير موجود
 * - كلمة مرور خاطئة لحساب موجود
 */
export function getDummyPasswordHash(): Promise<string> {
  if (!dummyPasswordHashPromise) {
    dummyPasswordHashPromise = hashPassword(DUMMY_PASSWORD);
  }

  return dummyPasswordHashPromise;
}