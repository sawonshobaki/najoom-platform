-- Assessments in V1 belong to exactly one lesson.
ALTER TABLE "assessments" ADD COLUMN "lessonId" TEXT NOT NULL;

CREATE INDEX "assessments_lessonId_idx" ON "assessments"("lessonId");

ALTER TABLE "assessments"
ADD CONSTRAINT "assessments_lessonId_fkey"
FOREIGN KEY ("lessonId") REFERENCES "lessons"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
