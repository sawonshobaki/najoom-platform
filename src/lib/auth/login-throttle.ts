import "server-only";

import { createHash } from "node:crypto";

import { LoginThrottleScope } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * إعدادات الحماية من محاولات تسجيل الدخول المتكررة.
 *
 * النافذة الزمنية: 15 دقيقة
 * يبدأ الحظر بعد 5 محاولات فاشلة.
 * الحظر مؤقت ويزداد تدريجيًا.
 */
const LOGIN_WINDOW_MINUTES = 15;
const FAILURE_LIMIT = 5;
const MAX_BLOCK_MINUTES = 30;

const MILLISECONDS_PER_MINUTE = 60 * 1000;

export type LoginThrottleStatus = {
  blocked: boolean;
  retryAfterSeconds: number;
};

/**
 * نحول المعرّف الخام إلى SHA-256 hash قبل تخزينه.
 *
 * لا نخزن اسم المستخدم أو مفتاح الشبكة الخام
 * داخل جدول throttling.
 */
export function hashThrottleIdentifier(
  identifier: string,
): string {
  return createHash("sha256")
    .update(identifier)
    .digest("hex");
}

/**
 * يحسب وقت انتهاء نافذة المحاولات الحالية.
 */
function getWindowExpiration(
  windowStartedAt: Date,
): Date {
  return new Date(
    windowStartedAt.getTime() +
      LOGIN_WINDOW_MINUTES * MILLISECONDS_PER_MINUTE,
  );
}

/**
 * يحسب مدة الحظر التصاعدي.
 *
 * 5 failures  -> 1 minute
 * 6 failures  -> 2 minutes
 * 7 failures  -> 4 minutes
 * ...
 * بحد أقصى 30 دقيقة.
 */
function getBlockDurationMinutes(
  failureCount: number,
): number {
  const overflow = Math.max(
    0,
    failureCount - FAILURE_LIMIT,
  );

  const blockMinutes = 2 ** overflow;

  return Math.min(
    blockMinutes,
    MAX_BLOCK_MINUTES,
  );
}

/**
 * يتحقق هل المعرّف محظور مؤقتًا.
 */
export async function getLoginThrottleStatus(
  scope: LoginThrottleScope,
  identifier: string,
): Promise<LoginThrottleStatus> {
  const identifierHash =
    hashThrottleIdentifier(identifier);

  const record =
    await prisma.loginThrottle.findUnique({
      where: {
        scope_identifierHash: {
          scope,
          identifierHash,
        },
      },
      select: {
        blockedUntil: true,
      },
    });

  if (!record?.blockedUntil) {
    return {
      blocked: false,
      retryAfterSeconds: 0,
    };
  }

  const now = new Date();

  if (record.blockedUntil <= now) {
    return {
      blocked: false,
      retryAfterSeconds: 0,
    };
  }

  const retryAfterMilliseconds =
    record.blockedUntil.getTime() -
    now.getTime();

  return {
    blocked: true,
    retryAfterSeconds: Math.ceil(
      retryAfterMilliseconds / 1000,
    ),
  };
}

/**
 * يسجل محاولة دخول فاشلة.
 *
 * لا يقفل الحساب نفسه.
 * إنما يطبق حظرًا مؤقتًا على هذا المفتاح فقط.
 */
export async function recordFailedLoginAttempt(
  scope: LoginThrottleScope,
  identifier: string,
): Promise<void> {
  const identifierHash =
    hashThrottleIdentifier(identifier);

  const now = new Date();

  const existing =
    await prisma.loginThrottle.findUnique({
      where: {
        scope_identifierHash: {
          scope,
          identifierHash,
        },
      },
    });

  /**
   * إذا لم يكن هناك سجل سابق،
   * ننشئ نافذة جديدة.
   */
  if (!existing) {
    await prisma.loginThrottle.create({
      data: {
        scope,
        identifierHash,
        failureCount: 1,
        windowStartedAt: now,
        lastFailureAt: now,
      },
    });

    return;
  }

  const windowExpired =
    getWindowExpiration(
      existing.windowStartedAt,
    ) <= now;

  /**
   * إذا انتهت النافذة السابقة،
   * نبدأ العد من جديد.
   */
  if (windowExpired) {
    await prisma.loginThrottle.update({
      where: {
        id: existing.id,
      },
      data: {
        failureCount: 1,
        windowStartedAt: now,
        lastFailureAt: now,
        blockedUntil: null,
      },
    });

    return;
  }

  const nextFailureCount =
    existing.failureCount + 1;

  let blockedUntil: Date | null = null;

  if (nextFailureCount >= FAILURE_LIMIT) {
    const blockMinutes =
      getBlockDurationMinutes(
        nextFailureCount,
      );

    blockedUntil = new Date(
      now.getTime() +
        blockMinutes *
          MILLISECONDS_PER_MINUTE,
    );
  }

  await prisma.loginThrottle.update({
    where: {
      id: existing.id,
    },
    data: {
      failureCount: nextFailureCount,
      lastFailureAt: now,
      blockedUntil,
    },
  });
}

/**
 * يمسح عداد المحاولات بعد تسجيل دخول ناجح.
 *
 * هذا لا يحذف أي سجل تدقيق أمني،
 * بل فقط بيانات throttling المؤقتة.
 */
export async function clearLoginThrottle(
  scope: LoginThrottleScope,
  identifier: string,
): Promise<void> {
  const identifierHash =
    hashThrottleIdentifier(identifier);

  await prisma.loginThrottle.deleteMany({
    where: {
      scope,
      identifierHash,
    },
  });
}
