-- CreateEnum
CREATE TYPE "PointEventType" AS ENUM ('CONCEPT_MASTERY', 'IMPROVEMENT', 'ACTIVITY_COMPLETION', 'PERSISTENCE', 'REMEDIAL_PLAN_COMPLETION', 'FLASHCARD_PROGRESS', 'ACHIEVEMENT', 'MANUAL_ADJUSTMENT');

-- CreateTable
CREATE TABLE "point_events" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "eventType" "PointEventType" NOT NULL,
    "points" INTEGER NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "metadata" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_points" (
    "studentId" TEXT NOT NULL,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_points_pkey" PRIMARY KEY ("studentId")
);

-- CreateTable
CREATE TABLE "badges" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "iconKey" TEXT NOT NULL,
    "criteriaJson" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_badges" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT,

    CONSTRAINT "student_badges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "point_events_studentId_createdAt_idx" ON "point_events"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "point_events_eventType_idx" ON "point_events"("eventType");

-- CreateIndex
CREATE INDEX "point_events_sourceType_sourceId_idx" ON "point_events"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "student_points_totalPoints_idx" ON "student_points"("totalPoints");

-- CreateIndex
CREATE UNIQUE INDEX "badges_name_key" ON "badges"("name");

-- CreateIndex
CREATE INDEX "badges_isActive_idx" ON "badges"("isActive");

-- CreateIndex
CREATE INDEX "student_badges_badgeId_idx" ON "student_badges"("badgeId");

-- CreateIndex
CREATE INDEX "student_badges_studentId_awardedAt_idx" ON "student_badges"("studentId", "awardedAt");

-- CreateIndex
CREATE UNIQUE INDEX "student_badges_studentId_badgeId_key" ON "student_badges"("studentId", "badgeId");

-- AddForeignKey
ALTER TABLE "point_events" ADD CONSTRAINT "point_events_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_events" ADD CONSTRAINT "point_events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_points" ADD CONSTRAINT "student_points_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_badges" ADD CONSTRAINT "student_badges_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_badges" ADD CONSTRAINT "student_badges_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "badges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
