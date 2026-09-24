-- CreateEnum
CREATE TYPE "ResourceSource" AS ENUM ('MANUAL', 'AI_SUGGESTED');

-- AlterTable
ALTER TABLE "resources" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "source" "ResourceSource" NOT NULL DEFAULT 'MANUAL';

-- CreateIndex
CREATE INDEX "resources_source_idx" ON "resources"("source");
