import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * نتأكد مبكرًا من وجود رابط قاعدة البيانات.
 * لا نستخدم fallback صامتًا لأن فشل الاتصال يجب أن يكون واضحًا.
 */
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured.");
}

/**
 * Prisma 7 يحتاج Driver Adapter للاتصال المباشر بـ PostgreSQL.
 */
const adapter = new PrismaPg({
  connectionString: databaseUrl,
});

/**
 * أثناء التطوير، Next.js قد يعيد تحميل الملفات عدة مرات.
 * نخزن PrismaClient على globalThis لتجنب إنشاء اتصالات متعددة.
 */
const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}