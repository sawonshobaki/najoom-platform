import "server-only";

import { LoginThrottleScope } from "@/generated/prisma/client";
import {
  clearLoginThrottle,
  getLoginThrottleStatus,
  recordFailedLoginAttempt,
} from "@/lib/auth/login-throttle";
import {
  INVALID_LOGIN_MESSAGE,
  loginWithUsernameAndPassword,
  type LoginResult,
} from "@/lib/auth/login-service";

export type LoginRequestInput = {
  username: string;
  password: string;

  /**
   * مفتاح شبكة موثوق يتم توفيره من طبقة HTTP.
   *
   * لا يجب تمرير X-Forwarded-For الخام مباشرة هنا.
   * إذا لم نستطع تحديد الشبكة بشكل موثوق، نتركه undefined.
   */
  networkKey?: string;
};

/**
 * يطبّع اسم المستخدم بنفس الأسلوب المستخدم أثناء تسجيل الدخول.
 */
function normalizeUsername(username: string): string {
  return username.trim();
}

/**
 * يبني مفتاحًا يجمع اسم المستخدم والشبكة.
 *
 * هذا المفتاح لا يُخزن بصورته الخام.
 * login-throttle سيخزن SHA-256 hash فقط.
 */
function buildUsernameNetworkIdentifier(
  username: string,
  networkKey: string,
): string {
  return `${username}:${networkKey}`;
}

/**
 * يعيد أكبر مدة انتظار من مجموعة حالات throttling.
 */
function getLongestRetryAfter(
  retryValues: number[],
): number {
  return Math.max(0, ...retryValues);
}

/**
 * ينسق عملية تسجيل الدخول القادمة من طبقة HTTP.
 *
 * الحماية موزعة على:
 *
 * USERNAME
 * تتم داخل login-service.
 *
 * NETWORK
 * تمنع مصدرًا واحدًا من تجربة أعداد كبيرة من الحسابات.
 *
 * USERNAME_NETWORK
 * تمنع شبكة واحدة من مهاجمة حساب معين بشكل متكرر.
 *
 * إذا لم يتوفر networkKey موثوق، نستمر بحماية USERNAME فقط.
 */
export async function loginFromRequest(
  input: LoginRequestInput,
): Promise<LoginResult> {
  const normalizedUsername =
    normalizeUsername(input.username);

  const networkKey = input.networkKey?.trim();

  /**
   * لا نحاول إنشاء throttling للشبكة إذا لم يكن
   * لدينا مفتاح شبكة موثوق.
   *
   * login-service سيظل يطبق USERNAME throttling.
   */
  if (!networkKey || !normalizedUsername) {
    return loginWithUsernameAndPassword(
      normalizedUsername,
      input.password,
    );
  }

  const usernameNetworkIdentifier =
    buildUsernameNetworkIdentifier(
      normalizedUsername,
      networkKey,
    );

  /**
   * نتحقق من نطاق الشبكة والنطاق المركب قبل
   * تنفيذ عملية Argon2 المكلفة.
   */
  const [
    networkThrottle,
    usernameNetworkThrottle,
  ] = await Promise.all([
    getLoginThrottleStatus(
      LoginThrottleScope.NETWORK,
      networkKey,
    ),
    getLoginThrottleStatus(
      LoginThrottleScope.USERNAME_NETWORK,
      usernameNetworkIdentifier,
    ),
  ]);

  if (
    networkThrottle.blocked ||
    usernameNetworkThrottle.blocked
  ) {
    return {
      success: false,
      message: INVALID_LOGIN_MESSAGE,
      retryAfterSeconds: getLongestRetryAfter([
        networkThrottle.retryAfterSeconds,
        usernameNetworkThrottle.retryAfterSeconds,
      ]),
    };
  }

  /**
   * login-service يطبق بدوره:
   * - USERNAME throttling
   * - Argon2 verification
   * - account active check
   * - session creation
   */
  const result =
    await loginWithUsernameAndPassword(
      normalizedUsername,
      input.password,
    );

  if (!result.success) {
    /**
     * محاولة فاشلة:
     * نسجلها على مستوى الشبكة والتركيبة.
     *
     * لا نخزن اسم المستخدم أو الشبكة بصورتهما الخام.
     */
    await Promise.all([
      recordFailedLoginAttempt(
        LoginThrottleScope.NETWORK,
        networkKey,
      ),
      recordFailedLoginAttempt(
        LoginThrottleScope.USERNAME_NETWORK,
        usernameNetworkIdentifier,
      ),
    ]);

    return result;
  }

  /**
   * تسجيل دخول ناجح:
   * نمسح العدادات المؤقتة الخاصة بهذه العملية.
   *
   * login-service يكون قد مسح USERNAME throttle أيضًا.
   */
await clearLoginThrottle(
  LoginThrottleScope.USERNAME_NETWORK,
  usernameNetworkIdentifier,
);

  return result;
}
