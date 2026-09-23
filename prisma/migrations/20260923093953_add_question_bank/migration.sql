-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'MULTIPLE_SELECT', 'MATCHING', 'ORDERING', 'FILL_IN_BLANK');

-- CreateEnum
CREATE TYPE "QuestionDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "QuestionSource" AS ENUM ('MANUAL', 'AI_GENERATED', 'IMPORTED');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "difficulty" "QuestionDifficulty" NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 1,
    "lessonId" TEXT NOT NULL,
    "conceptId" TEXT,
    "learningObjectiveId" TEXT,
    "source" "QuestionSource" NOT NULL DEFAULT 'MANUAL',
    "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_options" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_matching_pairs" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "leftText" TEXT NOT NULL,
    "rightText" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "question_matching_pairs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_ordering_items" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "correctOrder" INTEGER NOT NULL,

    CONSTRAINT "question_ordering_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_blank_answers" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,

    CONSTRAINT "question_blank_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "questions_lessonId_idx" ON "questions"("lessonId");

-- CreateIndex
CREATE INDEX "questions_conceptId_idx" ON "questions"("conceptId");

-- CreateIndex
CREATE INDEX "questions_learningObjectiveId_idx" ON "questions"("learningObjectiveId");

-- CreateIndex
CREATE INDEX "questions_type_idx" ON "questions"("type");

-- CreateIndex
CREATE INDEX "questions_difficulty_idx" ON "questions"("difficulty");

-- CreateIndex
CREATE INDEX "questions_status_idx" ON "questions"("status");

-- CreateIndex
CREATE INDEX "questions_source_idx" ON "questions"("source");

-- CreateIndex
CREATE INDEX "question_options_questionId_idx" ON "question_options"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "question_options_questionId_sortOrder_key" ON "question_options"("questionId", "sortOrder");

-- CreateIndex
CREATE INDEX "question_matching_pairs_questionId_idx" ON "question_matching_pairs"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "question_matching_pairs_questionId_sortOrder_key" ON "question_matching_pairs"("questionId", "sortOrder");

-- CreateIndex
CREATE INDEX "question_ordering_items_questionId_idx" ON "question_ordering_items"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "question_ordering_items_questionId_correctOrder_key" ON "question_ordering_items"("questionId", "correctOrder");

-- CreateIndex
CREATE INDEX "question_blank_answers_questionId_idx" ON "question_blank_answers"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "question_blank_answers_questionId_answer_key" ON "question_blank_answers"("questionId", "answer");

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "concepts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_learningObjectiveId_fkey" FOREIGN KEY ("learningObjectiveId") REFERENCES "learning_objectives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_matching_pairs" ADD CONSTRAINT "question_matching_pairs_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_ordering_items" ADD CONSTRAINT "question_ordering_items_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_blank_answers" ADD CONSTRAINT "question_blank_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
