-- Keep legacy submission grades while allowing direct 0/1 reviews for external assignments.
ALTER TABLE "assignment_grades"
  ALTER COLUMN "submissionId" DROP NOT NULL,
  ADD COLUMN "assignmentId" TEXT,
  ADD COLUMN "studentId" TEXT;

CREATE UNIQUE INDEX "assignment_grades_assignmentId_studentId_key"
  ON "assignment_grades"("assignmentId", "studentId");
CREATE INDEX "assignment_grades_assignmentId_idx"
  ON "assignment_grades"("assignmentId");
CREATE INDEX "assignment_grades_studentId_idx"
  ON "assignment_grades"("studentId");

ALTER TABLE "assignment_grades"
  ADD CONSTRAINT "assignment_grades_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "assignment_grades_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "assignment_grades_target_check"
  CHECK (
    ("submissionId" IS NOT NULL AND "assignmentId" IS NULL AND "studentId" IS NULL)
    OR
    ("submissionId" IS NULL AND "assignmentId" IS NOT NULL AND "studentId" IS NOT NULL)
  ),
  ADD CONSTRAINT "assignment_grades_external_score_check"
  CHECK ("submissionId" IS NOT NULL OR "score" IN (0, 1));
