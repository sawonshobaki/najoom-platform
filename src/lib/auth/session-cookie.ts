import "server-only";

import { cookies } from "next/headers";

import {
  SESSION_COOKIE_MAX_AGE_SECONDS,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";

/**
 * إعدادات الكوكي الخاصة بالجلسة.
 *
 * HttpOnly:
 * تمنع JavaScript في المتصفح من قراءة الكوكي.
 *
 * Secure:
 * تعمل في production فقط لأن Codespaces والتطوير قد لا يستخدمان HTTPS دائمًا
 * بالشكل نفسه.
 *
 * SameSite=Lax:
 * تقلل مخاطر CSRF مع الحفاظ على سلوك تسجيل الدخول الطبيعي.
 */
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
};

/**
 * يحفظ Session Token الخام داخل كوكي آمنة.
 *
 * الرمز الخام لا يذهب إلى قاعدة البيانات.
 */
export async function setSessionCookie(
  sessionToken: string,
  expiresAt: Date,
): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    ...SESSION_COOKIE_OPTIONS,
    expires: expiresAt,
  });
}

/**
 * يقرأ Session Token من الكوكي.
 *
 * إذا لم تكن هناك جلسة، يرجع null.
 */
export async function getSessionTokenFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  return sessionCookie?.value ?? null;
}

/**
 * يحذف كوكي الجلسة من المتصفح.
 *
 * هذا لا يبطل سجل الجلسة في قاعدة البيانات وحده.
 * عملية logout الكاملة ستقوم بإبطال الجلسة ثم حذف الكوكي.
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, "", {
    ...SESSION_COOKIE_OPTIONS,
    expires: new Date(0),
    maxAge: 0,
  });
}