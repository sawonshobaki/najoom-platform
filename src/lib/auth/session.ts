import "server-only";

import { createHash, randomBytes } from "node:crypto";

/**
 * اسم الكوكي المستخدمة لحفظ رمز الجلسة.
 */
export const SESSION_COOKIE_NAME = "najoom_session";

/**
 * مدة الجلسة الحالية: 7 أيام.
 */
export const SESSION_DURATION_DAYS = 7;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * ينشئ Session Token عشوائيًا وآمنًا.
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * يخزن التطبيق Hash للرمز فقط داخل قاعدة البيانات.
 */
export function hashSessionToken(sessionToken: string): string {
  return createHash("sha256").update(sessionToken).digest("hex");
}

/**
 * يحسب تاريخ انتهاء الجلسة.
 */
export function getSessionExpirationDate(
  now: Date = new Date(),
): Date {
  return new Date(
    now.getTime() + SESSION_DURATION_DAYS * MILLISECONDS_PER_DAY,
  );
}

/**
 * يتحقق هل انتهت الجلسة.
 */
export function isSessionExpired(
  expiresAt: Date,
  now: Date = new Date(),
): boolean {
  return expiresAt.getTime() <= now.getTime();
}

/**
 * مدة الكوكي بالثواني.
 */
export const SESSION_COOKIE_MAX_AGE_SECONDS =
  SESSION_DURATION_DAYS * 24 * 60 * 60;