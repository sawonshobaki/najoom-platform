-- Preserve legacy internal assignments while adding the external-link archive.
ALTER TABLE "assignments"
  ADD COLUMN "lessonId" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "externalUrl" TEXT,
  ADD COLUMN "weekNumber" INTEGER,
  ALTER COLUMN "prompt" DROP NOT NULL,
  ALTER COLUMN "maxScore" DROP NOT NULL;

CREATE INDEX "assignments_lessonId_idx" ON "assignments"("lessonId");
CREATE INDEX "assignments_weekNumber_idx" ON "assignments"("weekNumber");
CREATE INDEX "assignments_createdAt_idx" ON "assignments"("createdAt");

ALTER TABLE "assignments"
  ADD CONSTRAINT "assignments_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "lessons"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
