import "server-only";

import { prisma } from "@/lib/db/prisma";
import {
  generateSessionToken,
  getSessionExpirationDate,
  hashSessionToken,
  isSessionExpired,
} from "@/lib/auth/session";

/**
 * البيانات التي نعيدها عند إنشاء جلسة جديدة.
 *
 * sessionToken:
 * هو الرمز الخام الذي سيذهب لاحقًا إلى الكوكي الآمنة فقط.
 *
 * sessionId:
 * معرف الجلسة داخل قاعدة البيانات.
 */
export type CreatedSession = {
  sessionId: string;
  sessionToken: string;
  expiresAt: Date;
};

/**
 * ينشئ جلسة جديدة للمستخدم.
 *
 * لا نخزن Session Token الخام في قاعدة البيانات.
 * يتم تخزين الـ hash فقط.
 */
export async function createSession(userId: string): Promise<CreatedSession> {
  const sessionToken = generateSessionToken();
  const tokenHash = hashSessionToken(sessionToken);
  const expiresAt = getSessionExpirationDate();

  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
    select: {
      id: true,
      expiresAt: true,
    },
  });

  return {
    sessionId: session.id,
    sessionToken,
    expiresAt: session.expiresAt,
  };
}

/**
 * يتحقق من Session Token ويرجع الجلسة والمستخدم
 * إذا كانت الجلسة صالحة والحساب فعالًا.
 */
export async function validateSessionToken(sessionToken: string) {
  const tokenHash = hashSessionToken(sessionToken);

  const session = await prisma.session.findUnique({
    where: {
      tokenHash,
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          role: true,
          isActive: true,
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  if (session.revokedAt) {
    return null;
  }

  if (isSessionExpired(session.expiresAt)) {
    return null;
  }

  if (!session.user.isActive) {
    return null;
  }

  return session;
}

/**
 * يبطل جلسة واحدة باستخدام معرفها الداخلي.
 */
export async function revokeSession(
  sessionId: string,
  revokeReason = "manual_logout",
): Promise<void> {
  await prisma.session.updateMany({
    where: {
      id: sessionId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
      revokeReason,
    },
  });
}

/**
 * يبطل جلسة اعتمادًا على الرمز الخام الموجود في الكوكي.
 */
export async function revokeSessionByToken(
  sessionToken: string,
  revokeReason = "manual_logout",
): Promise<void> {
  const tokenHash = hashSessionToken(sessionToken);

  await prisma.session.updateMany({
    where: {
      tokenHash,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
      revokeReason,
    },
  });
}

/**
 * يبطل جميع جلسات المستخدم.
 *
 * سنستخدمه لاحقًا في:
 * - تسجيل الخروج من جميع الأجهزة
 * - إعادة تعيين كلمة المرور
 * - تعطيل الحساب
 */
export async function revokeAllUserSessions(
  userId: string,
  revokeReason: string,
): Promise<number> {
  const result = await prisma.session.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
      revokeReason,
    },
  });

  return result.count;
}

/**
 * يحدّث وقت آخر نشاط للجلسة.
 *
 * لا ينبغي تشغيله مع كل request حتى لا نزيد الكتابة
 * على قاعدة البيانات بلا فائدة.
 */
export async function updateSessionLastSeen(
  sessionId: string,
): Promise<void> {
  await prisma.session.updateMany({
    where: {
      id: sessionId,
      revokedAt: null,
    },
    data: {
      lastSeenAt: new Date(),
    },
  });
}

/**
 * يحذف الجلسات القديمة جدًا.
 *
 * هذه وظيفة صيانة دورية وليست جزءًا من كل طلب.
 */
export async function deleteOldSessions(
  olderThan: Date,
): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: {
      OR: [
        {
          expiresAt: {
            lt: olderThan,
          },
        },
        {
          revokedAt: {
            lt: olderThan,
          },
        },
      ],
    },
  });

  return result.count;
}