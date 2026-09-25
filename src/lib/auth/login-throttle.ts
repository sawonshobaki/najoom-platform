import "server-only";

import { createHash } from "node:crypto";

import { LoginThrottleScope } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

const MILLISECONDS_PER_MINUTE = 60 * 1000;

type LoginThrottlePolicy = {
  windowMinutes: number;
  failureLimit: number;
  maxBlockMinutes: number;
  fixedBlockMinutes?: number;
};

/**
 * لكل نطاق سياسة مستقلة.
 *
 * USERNAME:
 * حماية حساب بعينه من التخمين المتكرر.
 *
 * USERNAME_NETWORK:
 * حماية حساب معين من مصدر شبكة واحد.
 *
 * NETWORK:
 * حماية عامة من مصدر شبكي يجرّب أعدادًا كبيرة من الحسابات.
 * الحد هنا أعلى بكثير لأن عدة طالبات قد يشتركن في نفس الشبكة.
 */
const LOGIN_THROTTLE_POLICIES: Record<
  LoginThrottleScope,
  LoginThrottlePolicy
> = {
  USERNAME: {
    windowMinutes: 15,
    failureLimit: 5,
    maxBlockMinutes: 30,
  },

  USERNAME_NETWORK: {
    windowMinutes: 15,
    failureLimit: 8,
    maxBlockMinutes: 15,
  },

  NETWORK: {
    windowMinutes: 15,
    failureLimit: 50,
    maxBlockMinutes: 5,
    fixedBlockMinutes: 5,
  },
};

export type LoginThrottleStatus = {
  blocked: boolean;
  retryAfterSeconds: number;
};

/**
 * نحول المعرّف الخام إلى hash قبل التخزين.
 *
 * ملاحظة:
 * SHA-256 يمنع تخزين القيمة الخام، لكنه لا يجعل
 * عناوين IP منخفضة التنوع مجهولة بشكل كامل.
 * سنستبدله لاحقًا بـ HMAC قبل تفعيل networkKey فعليًا.
 */
export function hashThrottleIdentifier(
  identifier: string,
): string {
  return createHash("sha256")
    .update(identifier)
    .digest("hex");
}

function getThrottlePolicy(
  scope: LoginThrottleScope,
): LoginThrottlePolicy {
  return LOGIN_THROTTLE_POLICIES[scope];
}

function getWindowExpiration(
  windowStartedAt: Date,
  windowMinutes: number,
): Date {
  return new Date(
    windowStartedAt.getTime() +
      windowMinutes * MILLISECONDS_PER_MINUTE,
  );
}

/**
 * USERNAME و USERNAME_NETWORK:
 * حظر تصاعدي 1، 2، 4، 8... حتى الحد الأقصى.
 *
 * NETWORK:
 * حظر ثابت وقصير لتجنب تعطيل شبكة مشتركة لفترة طويلة.
 */
function getBlockDurationMinutes(
  failureCount: number,
  policy: LoginThrottlePolicy,
): number {
  if (policy.fixedBlockMinutes) {
    return policy.fixedBlockMinutes;
  }

  const overflow = Math.max(
    0,
    failureCount - policy.failureLimit,
  );

  const blockMinutes = 2 ** overflow;

  return Math.min(
    blockMinutes,
    policy.maxBlockMinutes,
  );
}

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

export async function recordFailedLoginAttempt(
  scope: LoginThrottleScope,
  identifier: string,
): Promise<void> {
  const identifierHash =
    hashThrottleIdentifier(identifier);

  const policy = getThrottlePolicy(scope);
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
      policy.windowMinutes,
    ) <= now;

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

  if (
    nextFailureCount >=
    policy.failureLimit
  ) {
    const blockMinutes =
      getBlockDurationMinutes(
        nextFailureCount,
        policy,
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
