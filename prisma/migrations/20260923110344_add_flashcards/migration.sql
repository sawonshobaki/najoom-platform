-- CreateEnum
CREATE TYPE "FlashcardDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "FlashcardSource" AS ENUM ('MANUAL', 'AI_GENERATED', 'IMPORTED');

-- CreateEnum
CREATE TYPE "FlashcardStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "flashcards" (
    "id" TEXT NOT NULL,
    "front" TEXT NOT NULL,
    "back" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "difficulty" "FlashcardDifficulty" NOT NULL DEFAULT 'MEDIUM',
    "source" "FlashcardSource" NOT NULL DEFAULT 'MANUAL',
    "status" "FlashcardStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flashcards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_flashcard_progress" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "flashcardId" TEXT NOT NULL,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "incorrectCount" INTEGER NOT NULL DEFAULT 0,
    "masteryScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastReviewedAt" TIMESTAMP(3),
    "nextReviewAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_flashcard_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "flashcards_conceptId_idx" ON "flashcards"("conceptId");

-- CreateIndex
CREATE INDEX "flashcards_difficulty_idx" ON "flashcards"("difficulty");

-- CreateIndex
CREATE INDEX "flashcards_status_idx" ON "flashcards"("status");

-- CreateIndex
CREATE INDEX "flashcards_source_idx" ON "flashcards"("source");

-- CreateIndex
CREATE INDEX "student_flashcard_progress_studentId_nextReviewAt_idx" ON "student_flashcard_progress"("studentId", "nextReviewAt");

-- CreateIndex
CREATE INDEX "student_flashcard_progress_flashcardId_idx" ON "student_flashcard_progress"("flashcardId");

-- CreateIndex
CREATE INDEX "student_flashcard_progress_masteryScore_idx" ON "student_flashcard_progress"("masteryScore");

-- CreateIndex
CREATE UNIQUE INDEX "student_flashcard_progress_studentId_flashcardId_key" ON "student_flashcard_progress"("studentId", "flashcardId");

-- AddForeignKey
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "concepts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_flashcard_progress" ADD CONSTRAINT "student_flashcard_progress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_flashcard_progress" ADD CONSTRAINT "student_flashcard_progress_flashcardId_fkey" FOREIGN KEY ("flashcardId") REFERENCES "flashcards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
