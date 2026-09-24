-- CreateEnum
CREATE TYPE "LoginThrottleScope" AS ENUM ('USERNAME', 'NETWORK', 'USERNAME_NETWORK');

-- CreateTable
CREATE TABLE "login_throttles" (
    "id" TEXT NOT NULL,
    "scope" "LoginThrottleScope" NOT NULL,
    "identifierHash" TEXT NOT NULL,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,
    "lastFailureAt" TIMESTAMP(3),
    "blockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "login_throttles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "login_throttles_blockedUntil_idx" ON "login_throttles"("blockedUntil");

-- CreateIndex
CREATE INDEX "login_throttles_updatedAt_idx" ON "login_throttles"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "login_throttles_scope_identifierHash_key" ON "login_throttles"("scope", "identifierHash");
