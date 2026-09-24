import "server-only";

import { LoginThrottleScope } from "@/generated/prisma/client";
import { startUserSession } from "@/lib/auth/auth-session";
import {
  clearLoginThrottle,
  getLoginThrottleStatus,
  recordFailedLoginAttempt,
} from "@/lib/auth/login-throttle";
import {
  getDummyPasswordHash,
  verifyPassword,
} from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";

/**
 * رسالة موحدة لفشل تسجيل الدخول.
 *
 * لا نكشف:
 * - هل اسم المستخدم موجود.
 * - هل الحساب معطل.
 * - هل كلمة المرور خاطئة.
 * - هل المستخدم تجاوز حد المحاولات.
 */
export const INVALID_LOGIN_MESSAGE =
  "بيانات الدخول غير صحيحة.";

export type LoginResult =
  | {
      success: true;
      userId: string;
    }
  | {
      success: false;
      message: string;
      retryAfterSeconds?: number;
    };

/**
 * يطبّع اسم المستخدم قبل البحث.
 */
function normalizeUsername(username: string): string {
  return username.trim();
}

/**
 * يحاول تسجيل دخول المستخدم مع حماية من:
 * - username enumeration
 * - brute force
 * - account state discovery
 *
 * ملاحظة:
 * الحماية الحالية مبنية على USERNAME فقط.
 * نطاق NETWORK سيضاف لاحقًا من طبقة HTTP.
 */
export async function loginWithUsernameAndPassword(
  username: string,
  password: string,
): Promise<LoginResult> {
  const normalizedUsername = normalizeUsername(username);

  if (!normalizedUsername || !password) {
    return {
      success: false,
      message: INVALID_LOGIN_MESSAGE,
    };
  }

  /**
   * نتحقق أولًا من throttling الخاص باسم المستخدم.
   *
   * هذا لا يقفل الحساب نفسه،
   * وإنما يوقف المحاولات مؤقتًا على هذا المفتاح.
   */
  const throttleStatus =
    await getLoginThrottleStatus(
      LoginThrottleScope.USERNAME,
      normalizedUsername,
    );

  if (throttleStatus.blocked) {
    return {
      success: false,
      message: INVALID_LOGIN_MESSAGE,
      retryAfterSeconds:
        throttleStatus.retryAfterSeconds,
    };
  }

  const user = await prisma.user.findUnique({
    where: {
      username: normalizedUsername,
    },
    select: {
      id: true,
      passwordHash: true,
      isActive: true,
    },
  });

  /**
   * إذا لم يوجد المستخدم، نجري تحقق Argon2 وهميًا
   * لتقليل إمكانية اكتشاف أسماء المستخدمين من فرق التوقيت.
   */
  if (!user) {
    const dummyPasswordHash =
      await getDummyPasswordHash();

    await verifyPassword(
      dummyPasswordHash,
      password,
    );

    await recordFailedLoginAttempt(
      LoginThrottleScope.USERNAME,
      normalizedUsername,
    );

    return {
      success: false,
      message: INVALID_LOGIN_MESSAGE,
    };
  }

  /**
   * نتحقق من كلمة المرور حتى للحساب غير الفعال.
   * هذا يقلل فرق التوقيت بين الحالات المختلفة.
   */
  const passwordMatches = await verifyPassword(
    user.passwordHash,
    password,
  );

  if (!passwordMatches || !user.isActive) {
    await recordFailedLoginAttempt(
      LoginThrottleScope.USERNAME,
      normalizedUsername,
    );

    return {
      success: false,
      message: INVALID_LOGIN_MESSAGE,
    };
  }

  /**
   * نجاح تسجيل الدخول:
   * - نمسح throttling المؤقت.
   * - ننشئ جلسة جديدة.
   */
  await clearLoginThrottle(
    LoginThrottleScope.USERNAME,
    normalizedUsername,
  );

  await startUserSession(user.id);

  return {
    success: true,
    userId: user.id,
  };
}
