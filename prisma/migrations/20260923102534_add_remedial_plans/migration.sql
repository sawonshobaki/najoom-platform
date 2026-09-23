-- CreateEnum
CREATE TYPE "RemedialPlanTargetType" AS ENUM ('STUDENT', 'GROUP', 'SECTION', 'GRADE');

-- CreateEnum
CREATE TYPE "RemedialPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RemedialPlanStepStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "RemedialPlanOutcome" AS ENUM ('PENDING_REASSESSMENT', 'IMPROVED', 'NEEDS_FURTHER_SUPPORT');

-- CreateTable
CREATE TABLE "remedial_plans" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "targetType" "RemedialPlanTargetType" NOT NULL,
    "targetStudentId" TEXT,
    "sectionId" TEXT,
    "gradeId" TEXT,
    "targetConceptId" TEXT NOT NULL,
    "status" "RemedialPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "generatedByAi" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "reassessedAt" TIMESTAMP(3),
    "outcome" "RemedialPlanOutcome" NOT NULL DEFAULT 'PENDING_REASSESSMENT',
    "outcomeNotes" TEXT,

    CONSTRAINT "remedial_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remedial_plan_students" (
    "planId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "remedial_plan_students_pkey" PRIMARY KEY ("planId","studentId")
);

-- CreateTable
CREATE TABLE "remedial_plan_steps" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "status" "RemedialPlanStepStatus" NOT NULL DEFAULT 'PENDING',
    "estimatedMinutes" INTEGER,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "remedial_plan_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "remedial_plans_targetStudentId_idx" ON "remedial_plans"("targetStudentId");

-- CreateIndex
CREATE INDEX "remedial_plans_sectionId_idx" ON "remedial_plans"("sectionId");

-- CreateIndex
CREATE INDEX "remedial_plans_gradeId_idx" ON "remedial_plans"("gradeId");

-- CreateIndex
CREATE INDEX "remedial_plans_targetConceptId_idx" ON "remedial_plans"("targetConceptId");

-- CreateIndex
CREATE INDEX "remedial_plans_status_idx" ON "remedial_plans"("status");

-- CreateIndex
CREATE INDEX "remedial_plans_targetType_idx" ON "remedial_plans"("targetType");

-- CreateIndex
CREATE INDEX "remedial_plan_students_studentId_idx" ON "remedial_plan_students"("studentId");

-- CreateIndex
CREATE INDEX "remedial_plan_steps_planId_status_idx" ON "remedial_plan_steps"("planId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "remedial_plan_steps_planId_orderIndex_key" ON "remedial_plan_steps"("planId", "orderIndex");

-- AddForeignKey
ALTER TABLE "remedial_plans" ADD CONSTRAINT "remedial_plans_targetStudentId_fkey" FOREIGN KEY ("targetStudentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remedial_plans" ADD CONSTRAINT "remedial_plans_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remedial_plans" ADD CONSTRAINT "remedial_plans_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "grades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remedial_plans" ADD CONSTRAINT "remedial_plans_targetConceptId_fkey" FOREIGN KEY ("targetConceptId") REFERENCES "concepts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remedial_plans" ADD CONSTRAINT "remedial_plans_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remedial_plan_students" ADD CONSTRAINT "remedial_plan_students_planId_fkey" FOREIGN KEY ("planId") REFERENCES "remedial_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remedial_plan_students" ADD CONSTRAINT "remedial_plan_students_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remedial_plan_steps" ADD CONSTRAINT "remedial_plan_steps_planId_fkey" FOREIGN KEY ("planId") REFERENCES "remedial_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
