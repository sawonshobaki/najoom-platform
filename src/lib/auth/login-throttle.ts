import "server-only";

import { createHmac } from "node:crypto";

import { LoginThrottleScope } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

const MILLISECONDS_PER_MINUTE = 60 * 1000;
const MAX_CONCURRENCY_RETRIES = 5;

type LoginThrottlePolicy = {
  windowMinutes: number;
  failureLimit: number;
  maxBlockMinutes: number;
  fixedBlockMinutes?: number;
};

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

function getThrottleHmacSecret(): string {
  const secret =
    process.env.LOGIN_THROTTLE_HMAC_SECRET;

  if (!secret) {
    throw new Error(
      "LOGIN_THROTTLE_HMAC_SECRET is not configured.",
    );
  }

  if (secret.length < 32) {
    throw new Error(
      "LOGIN_THROTTLE_HMAC_SECRET must be at least 32 characters.",
    );
  }

  return secret;
}

/**
 * نخزن HMAC للمعرّف بدل القيمة الخام.
 *
 * هذا أفضل من SHA-256 العادي خصوصًا للمعرفات
 * منخفضة التنوع مثل عناوين IP، لأن إعادة حساب
 * القيمة تتطلب معرفة السر الموجود على الخادم.
 */
export function hashThrottleIdentifier(
  identifier: string,
): string {
  return createHmac(
    "sha256",
    getThrottleHmacSecret(),
  )
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

function isUniqueConstraintError(
  error: unknown,
): boolean {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error)
  ) {
    return false;
  }

  return error.code === "P2002";
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

  for (
    let attempt = 0;
    attempt < MAX_CONCURRENCY_RETRIES;
    attempt += 1
  ) {
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
      try {
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
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          continue;
        }

        throw error;
      }
    }

    const windowExpired =
      getWindowExpiration(
        existing.windowStartedAt,
        policy.windowMinutes,
      ) <= now;

    if (windowExpired) {
      const resetResult =
        await prisma.loginThrottle.updateMany({
          where: {
            id: existing.id,
            failureCount: existing.failureCount,
            windowStartedAt:
              existing.windowStartedAt,
          },
          data: {
            failureCount: 1,
            windowStartedAt: now,
            lastFailureAt: now,
            blockedUntil: null,
          },
        });

      if (resetResult.count === 1) {
        return;
      }

      continue;
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

    const updateResult =
      await prisma.loginThrottle.updateMany({
        where: {
          id: existing.id,
          failureCount: existing.failureCount,
          windowStartedAt:
            existing.windowStartedAt,
        },
        data: {
          failureCount: nextFailureCount,
          lastFailureAt: now,
          blockedUntil,
        },
      });

    if (updateResult.count === 1) {
      return;
    }
  }

  throw new Error(
    "Unable to record login throttle after concurrent updates.",
  );
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
