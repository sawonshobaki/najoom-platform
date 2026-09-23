-- CreateTable
CREATE TABLE "semesters" (
    "id" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "semesters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concepts" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "concepts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_objectives" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "learning_objectives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_objective_skills" (
    "learningObjectiveId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,

    CONSTRAINT "learning_objective_skills_pkey" PRIMARY KEY ("learningObjectiveId","skillId")
);

-- CreateIndex
CREATE INDEX "semesters_gradeId_idx" ON "semesters"("gradeId");

-- CreateIndex
CREATE UNIQUE INDEX "semesters_gradeId_academicYear_sortOrder_key" ON "semesters"("gradeId", "academicYear", "sortOrder");

-- CreateIndex
CREATE INDEX "units_semesterId_idx" ON "units"("semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "units_semesterId_sortOrder_key" ON "units"("semesterId", "sortOrder");

-- CreateIndex
CREATE INDEX "lessons_unitId_idx" ON "lessons"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "lessons_unitId_sortOrder_key" ON "lessons"("unitId", "sortOrder");

-- CreateIndex
CREATE INDEX "concepts_lessonId_idx" ON "concepts"("lessonId");

-- CreateIndex
CREATE INDEX "learning_objectives_lessonId_idx" ON "learning_objectives"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "skills_name_key" ON "skills"("name");

-- CreateIndex
CREATE INDEX "learning_objective_skills_skillId_idx" ON "learning_objective_skills"("skillId");

-- AddForeignKey
ALTER TABLE "semesters" ADD CONSTRAINT "semesters_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "grades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concepts" ADD CONSTRAINT "concepts_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_objectives" ADD CONSTRAINT "learning_objectives_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_objective_skills" ADD CONSTRAINT "learning_objective_skills_learningObjectiveId_fkey" FOREIGN KEY ("learningObjectiveId") REFERENCES "learning_objectives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_objective_skills" ADD CONSTRAINT "learning_objective_skills_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;
