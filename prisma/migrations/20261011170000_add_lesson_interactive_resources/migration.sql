-- CreateEnum
CREATE TYPE "LessonResourceType" AS ENUM ('VIDEO', 'GAME', 'SIMULATION', 'ARTICLE');

-- CreateTable
CREATE TABLE "lesson_resources" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" "LessonResourceType" NOT NULL,
    "language" TEXT NOT NULL,
    "isFree" BOOLEAN NOT NULL,
    "instructionsArabic" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_resources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lesson_resources_lessonId_sortOrder_idx" ON "lesson_resources"("lessonId", "sortOrder");

-- AddForeignKey
ALTER TABLE "lesson_resources" ADD CONSTRAINT "lesson_resources_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
