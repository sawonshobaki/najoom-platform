import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { requireStudent } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { validAttemptId, validateAnswerRequest } from "./attempt-validation";

type SnapshotOption = { optionId: string; text: string; sortOrder: number; isCorrect: boolean };
export type QuestionSnapshot = {
  version: 1;
  questionId: string;
  text: string;
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE";
  points: number;
  options: SnapshotOption[];
};

export class AttemptServiceError extends Error {
  constructor(public readonly code:
    | "student_not_found" | "assessment_not_found" | "assessment_unavailable" | "assessment_empty"
    | "unsupported_question" | "attempt_exists" | "attempt_not_found" | "attempt_submitted"
    | "attempt_question_not_found" | "option_not_found" | "snapshot_invalid" | "attempt_conflict") {
    super({
      student_not_found: "ملف الطالبة غير متاح.", assessment_not_found: "الاختبار غير موجود.",
      assessment_unavailable: "هذا الاختبار غير متاح للبدء.", assessment_empty: "لا يحتوي الاختبار أسئلة بعد.",
      unsupported_question: "يحتوي الاختبار نوع سؤال غير مدعوم.", attempt_exists: "لديكِ محاولة سابقة لهذا الاختبار.",
      attempt_not_found: "المحاولة غير موجودة.", attempt_submitted: "تم تسليم هذه المحاولة ولا يمكن تعديلها.",
      attempt_question_not_found: "السؤال غير موجود في هذه المحاولة.", option_not_found: "الخيار المحدد لا ينتمي إلى هذا السؤال.",
      snapshot_invalid: "تعذر قراءة نسخة السؤال المحفوظة.", attempt_conflict: "تغيّرت المحاولة أثناء العملية. أعيدي تحميل الصفحة.",
    }[code]);
  }
}

async function currentStudent() {
  const user = await requireStudent();
  const student = await prisma.student.findUnique({ where: { userId: user.id }, select: { id: true, isActive: true } });
  if (!student?.isActive) throw new AttemptServiceError("student_not_found");
  return student;
}

function buildSnapshot(item: {
  pointsOverride: number | null;
  question: { id: string; text: string; type: string; points: number; options: { id: string; text: string; sortOrder: number; isCorrect: boolean }[] };
}): QuestionSnapshot {
  if (item.question.type !== "MULTIPLE_CHOICE" && item.question.type !== "TRUE_FALSE") throw new AttemptServiceError("unsupported_question");
  if (item.question.options.length < 2 || item.question.options.filter(option => option.isCorrect).length !== 1) throw new AttemptServiceError("snapshot_invalid");
  return { version: 1, questionId: item.question.id, text: item.question.text, type: item.question.type,
    points: item.pointsOverride ?? item.question.points,
    options: item.question.options.map(option => ({ optionId: option.id, text: option.text, sortOrder: option.sortOrder, isCorrect: option.isCorrect })) };
}

export function parseQuestionSnapshot(value: Prisma.JsonValue): QuestionSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AttemptServiceError("snapshot_invalid");
  const row = value as Record<string, unknown>;
  if (row.version !== 1 || typeof row.questionId !== "string" || typeof row.text !== "string"
    || (row.type !== "MULTIPLE_CHOICE" && row.type !== "TRUE_FALSE") || !Number.isInteger(row.points) || Number(row.points) < 0
    || !Array.isArray(row.options)) throw new AttemptServiceError("snapshot_invalid");
  const options = row.options.map(option => {
    if (!option || typeof option !== "object" || Array.isArray(option)) throw new AttemptServiceError("snapshot_invalid");
    const item = option as Record<string, unknown>;
    if (typeof item.optionId !== "string" || typeof item.text !== "string" || !Number.isInteger(item.sortOrder) || typeof item.isCorrect !== "boolean") throw new AttemptServiceError("snapshot_invalid");
    return { optionId: item.optionId, text: item.text, sortOrder: Number(item.sortOrder), isCorrect: item.isCorrect };
  });
  if (options.length < 2 || options.filter(option => option.isCorrect).length !== 1) throw new AttemptServiceError("snapshot_invalid");
  return { version: 1, questionId: row.questionId, text: row.text, type: row.type, points: Number(row.points), options };
}

function studentQuestion(id: string, sortOrder: number, snapshot: QuestionSnapshot) {
  return { id, sortOrder, text: snapshot.text, type: snapshot.type, points: snapshot.points,
    options: snapshot.options.map(({ optionId, text, sortOrder: optionOrder }) => ({ id: optionId, text, sortOrder: optionOrder })) };
}

const assessmentForStartSelect = {
  id: true, title: true, status: true, durationSeconds: true,
  lesson: { select: { id: true, title: true } },
  questions: { orderBy: { sortOrder: "asc" as const }, select: {
    id: true, sortOrder: true, pointsOverride: true, questionSnapshot: true,
    question: { select: { id: true, text: true, type: true, points: true,
      options: { orderBy: { sortOrder: "asc" as const }, select: { id: true, text: true, sortOrder: true, isCorrect: true } } } },
  } },
} satisfies Prisma.AssessmentSelect;

export async function startAssessmentAttempt(assessmentIdInput: string) {
  const student = await currentStudent();
  const assessmentId = validAttemptId(assessmentIdInput);
  try {
    return await prisma.$transaction(async tx => {
      const assessment = await tx.assessment.findUnique({ where: { id: assessmentId }, select: assessmentForStartSelect });
      if (!assessment) throw new AttemptServiceError("assessment_not_found");
      if (assessment.status === "CLOSED" || assessment.status === "ARCHIVED") throw new AttemptServiceError("assessment_unavailable");
      if (!assessment.questions.length) throw new AttemptServiceError("assessment_empty");
      const existing = await tx.assessmentAttempt.findUnique({ where: { assessmentId_studentId: { assessmentId, studentId: student.id } }, select: { id: true } });
      if (existing) throw new AttemptServiceError("attempt_exists");

      const snapshots = assessment.questions.map(item => item.questionSnapshot ? parseQuestionSnapshot(item.questionSnapshot) : buildSnapshot(item));
      for (let index = 0; index < assessment.questions.length; index += 1) {
        const item = assessment.questions[index];
        if (!item.questionSnapshot) await tx.assessmentQuestion.updateMany({ where: { id: item.id, questionSnapshot: { equals: Prisma.DbNull } }, data: { questionSnapshot: snapshots[index] as unknown as Prisma.InputJsonValue } });
      }
      const attempt = await tx.assessmentAttempt.create({ data: { assessmentId, studentId: student.id }, select: { id: true, startedAt: true, status: true } });
      return { attemptId: attempt.id, status: attempt.status, startedAt: attempt.startedAt, assessment: {
        id: assessment.id, title: assessment.title, durationSeconds: assessment.durationSeconds, lesson: assessment.lesson,
      }, questions: assessment.questions.map((item, index) => studentQuestion(item.id, item.sortOrder, snapshots[index])) };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AttemptServiceError("attempt_exists");
    throw error;
  }
}
export type StudentAttemptPayload = Awaited<ReturnType<typeof startAssessmentAttempt>>;

export async function saveAssessmentAnswer(attemptIdInput: string, assessmentQuestionIdInput: string, input: unknown) {
  const student = await currentStudent();
  const attemptId = validAttemptId(attemptIdInput);
  const assessmentQuestionId = validAttemptId(assessmentQuestionIdInput);
  const { optionId } = validateAnswerRequest(input);
  return prisma.$transaction(async tx => {
    const attempt = await tx.assessmentAttempt.findUnique({ where: { id: attemptId }, select: {
      id: true, studentId: true, status: true, assessment: { select: { questions: { where: { id: assessmentQuestionId }, select: { id: true, questionSnapshot: true } } } },
    } });
    if (!attempt || attempt.studentId !== student.id) throw new AttemptServiceError("attempt_not_found");
    if (attempt.status !== "IN_PROGRESS") throw new AttemptServiceError("attempt_submitted");
    const assessmentQuestion = attempt.assessment.questions[0];
    if (!assessmentQuestion) throw new AttemptServiceError("attempt_question_not_found");
    const snapshot = parseQuestionSnapshot(assessmentQuestion.questionSnapshot);
    if (!snapshot.options.some(option => option.optionId === optionId)) throw new AttemptServiceError("option_not_found");
    const answer = await tx.assessmentAnswer.upsert({
      where: { attemptId_assessmentQuestionId: { attemptId, assessmentQuestionId } },
      create: { attemptId, assessmentQuestionId, answerPayload: { optionId }, isCorrect: null, awardedPoints: null },
      update: { answerPayload: { optionId }, isCorrect: null, awardedPoints: null, answeredAt: new Date() },
      select: { id: true, answeredAt: true },
    });
    return { assessmentQuestionId, selectedOptionId: optionId, answered: true, savedAt: answer.answeredAt };
  });
}

function selectedOptionId(value: Prisma.JsonValue) {
  return value && typeof value === "object" && !Array.isArray(value) && typeof (value as Record<string, unknown>).optionId === "string"
    ? (value as Record<string, string>).optionId : null;
}

export async function submitAssessmentAttempt(attemptIdInput: string) {
  const student = await currentStudent();
  const attemptId = validAttemptId(attemptIdInput);
  try {
    return await prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "assessment_attempts" WHERE "id" = ${attemptId} FOR UPDATE`);
      const attempt = await tx.assessmentAttempt.findUnique({ where: { id: attemptId }, select: {
        id: true, studentId: true, status: true,
        assessment: { select: { id: true, title: true, questions: { orderBy: { sortOrder: "asc" }, select: { id: true, questionSnapshot: true } } } },
        answers: { select: { id: true, assessmentQuestionId: true, answerPayload: true } },
      } });
      if (!attempt || attempt.studentId !== student.id) throw new AttemptServiceError("attempt_not_found");
      if (attempt.status !== "IN_PROGRESS") throw new AttemptServiceError("attempt_submitted");
      const answerByQuestion = new Map(attempt.answers.map(answer => [answer.assessmentQuestionId, answer]));
      let earnedPoints = 0;
      let totalPoints = 0;
      const questionResults = [];
      for (const item of attempt.assessment.questions) {
        const snapshot = parseQuestionSnapshot(item.questionSnapshot);
        const answer = answerByQuestion.get(item.id);
        const optionId = answer ? selectedOptionId(answer.answerPayload) : null;
        const correctOption = snapshot.options.find(option => option.isCorrect)!;
        const isCorrect = optionId === correctOption.optionId;
        const awardedPoints = isCorrect ? snapshot.points : 0;
        totalPoints += snapshot.points; earnedPoints += awardedPoints;
        if (answer) await tx.assessmentAnswer.update({ where: { id: answer.id }, data: { isCorrect, awardedPoints } });
        questionResults.push({ assessmentQuestionId: item.id, answered: Boolean(optionId), correct: isCorrect, awardedPoints, points: snapshot.points,
          correctOption: { id: correctOption.optionId, text: correctOption.text } });
      }
      const submittedAt = new Date();
      await tx.assessmentAttempt.update({ where: { id: attempt.id }, data: { status: "GRADED", submittedAt, score: earnedPoints, maxScore: totalPoints } });
      return { attemptId: attempt.id, assessmentId: attempt.assessment.id, title: attempt.assessment.title, status: "GRADED" as const,
        submittedAt, earnedPoints, totalPoints, percentage: totalPoints ? Math.round((earnedPoints / totalPoints) * 10000) / 100 : 0,
        correctCount: questionResults.filter(result => result.correct).length, questionCount: questionResults.length, questionResults };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") throw new AttemptServiceError("attempt_conflict");
    throw error;
  }
}
export type AssessmentAttemptResult = Awaited<ReturnType<typeof submitAssessmentAttempt>>;
