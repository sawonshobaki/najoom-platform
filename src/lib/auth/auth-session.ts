import "server-only";

import {
  clearSessionCookie,
  getSessionTokenFromCookie,
  setSessionCookie,
} from "@/lib/auth/session-cookie";
import {
  createSession,
  revokeSessionByToken,
  validateSessionToken,
} from "@/lib/auth/session-service";

/**
 * ينشئ جلسة كاملة للمستخدم:
 * 1. ينشئ Session داخل قاعدة البيانات.
 * 2. يضع الرمز الخام داخل HttpOnly Cookie.
 */
export async function startUserSession(userId: string): Promise<void> {
  const session = await createSession(userId);

  await setSessionCookie(
    session.sessionToken,
    session.expiresAt,
  );
}

/**
 * يعيد بيانات الجلسة الحالية إذا كانت صالحة.
 *
 * إذا لم توجد كوكي أو كانت الجلسة:
 * - منتهية
 * - ملغاة
 * - مرتبطة بحساب غير فعال
 *
 * فسيتم إرجاع null.
 */
export async function getCurrentSession() {
  const sessionToken = await getSessionTokenFromCookie();

  if (!sessionToken) {
    return null;
  }

  return validateSessionToken(sessionToken);
}

/**
 * يعيد المستخدم الحالي فقط.
 *
 * هذه الدالة ستكون مفيدة جدًا داخل الصفحات
 * والـ Server Actions.
 */
export async function getCurrentUser() {
  const session = await getCurrentSession();

  return session?.user ?? null;
}

/**
 * ينهي الجلسة الحالية بالكامل:
 * 1. يبطل الجلسة في قاعدة البيانات.
 * 2. يحذف الكوكي من المتصفح.
 *
 * حذف الكوكي وحده غير كافٍ أمنيًا،
 * لذلك نقوم بإبطال سجل الجلسة أيضًا.
 */
export async function endCurrentSession(): Promise<void> {
  const sessionToken = await getSessionTokenFromCookie();

  if (sessionToken) {
    await revokeSessionByToken(
      sessionToken,
      "manual_logout",
    );
  }

  await clearSessionCookie();
}