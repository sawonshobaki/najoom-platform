/*
  Warnings:

  - You are about to drop the `student_section_history` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "student_section_history" DROP CONSTRAINT "student_section_history_changedById_fkey";

-- DropForeignKey
ALTER TABLE "student_section_history" DROP CONSTRAINT "student_section_history_fromSectionId_fkey";

-- DropForeignKey
ALTER TABLE "student_section_history" DROP CONSTRAINT "student_section_history_studentId_fkey";

-- DropForeignKey
ALTER TABLE "student_section_history" DROP CONSTRAINT "student_section_history_toSectionId_fkey";

-- DropTable
DROP TABLE "student_section_history";
