-- CreateEnum
CREATE TYPE "ErrorPatternStatus" AS ENUM ('ACTIVE', 'RESOLVED');

-- CreateTable
CREATE TABLE "student_concept_mastery" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "masteryScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "attemptsCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "incorrectCount" INTEGER NOT NULL DEFAULT 0,
    "lastAssessedAt" TIMESTAMP(3),
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_concept_mastery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_error_patterns" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "patternKey" TEXT NOT NULL,
    "occurrences" INTEGER NOT NULL DEFAULT 0,
    "assessmentsCount" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" TIMESTAMP(3),
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "ErrorPatternStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_error_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_concept_mastery_conceptId_idx" ON "student_concept_mastery"("conceptId");

-- CreateIndex
CREATE INDEX "student_concept_mastery_masteryScore_idx" ON "student_concept_mastery"("masteryScore");

-- CreateIndex
CREATE UNIQUE INDEX "student_concept_mastery_studentId_conceptId_key" ON "student_concept_mastery"("studentId", "conceptId");

-- CreateIndex
CREATE INDEX "student_error_patterns_studentId_status_idx" ON "student_error_patterns"("studentId", "status");

-- CreateIndex
CREATE INDEX "student_error_patterns_conceptId_idx" ON "student_error_patterns"("conceptId");

-- CreateIndex
CREATE INDEX "student_error_patterns_confidenceScore_idx" ON "student_error_patterns"("confidenceScore");

-- CreateIndex
CREATE UNIQUE INDEX "student_error_patterns_studentId_conceptId_patternKey_key" ON "student_error_patterns"("studentId", "conceptId", "patternKey");

-- AddForeignKey
ALTER TABLE "student_concept_mastery" ADD CONSTRAINT "student_concept_mastery_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_concept_mastery" ADD CONSTRAINT "student_concept_mastery_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "concepts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_error_patterns" ADD CONSTRAINT "student_error_patterns_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_error_patterns" ADD CONSTRAINT "student_error_patterns_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "concepts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
