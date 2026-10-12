import { describe, expect, it } from "vitest";
import { QuestionDifficulty, QuestionType } from "@/generated/prisma/enums";
import { createTrueFalseOptions, normalizeOptionText, QuestionValidationError, validateCreateQuestionInput } from "./question-validation";

const valid = () => ({
  lessonId: "lesson-1", text: "ما الإجابة؟", type: "MULTIPLE_CHOICE", difficulty: "MEDIUM",
  options: [{ text: "الأولى", isCorrect: true }, { text: "الثانية", isCorrect: false }],
});
const parse = (changes: Record<string, unknown>) => validateCreateQuestionInput({ ...valid(), ...changes });

describe("V1 question create contract", () => {
  it("normalizes a valid MCQ without mutating the input", () => {
    const input = { ...valid(), text: " سؤال ", lessonId: " lesson-1 " };
    const before = structuredClone(input);
    expect(validateCreateQuestionInput(input)).toEqual({ ...input, text: "سؤال", lessonId: "lesson-1", explanation: null,
      learningObjectiveId: null, options: input.options.map((option, i) => ({ ...option, sortOrder: i + 1 })) });
    expect(input).toEqual(before);
  });
  it.each([true, false])("accepts true/false with correct answer %s", answer => {
    const options = createTrueFalseOptions(answer);
    expect(options.map(o => o.text)).toEqual(["صحيح", "خطأ"]);
    expect(options.map(o => o.isCorrect)).toEqual([answer, !answer]);
    expect(parse({ type: "TRUE_FALSE", options }).options).toHaveLength(2);
  });
  it("rejects a non-boolean true/false helper argument", () => {
    // Exercise runtime callers, not only TypeScript callers.
    // @ts-expect-error intentionally invalid input
    expect(() => createTrueFalseOptions("false")).toThrow(QuestionValidationError);
  });
  it.each(Object.values(QuestionType).filter(type => !["MULTIPLE_CHOICE", "TRUE_FALSE"].includes(type)))
    ("rejects deferred Prisma type %s", type => expect(() => parse({ type })).toThrow(QuestionValidationError));
  it.each(["SHORT_ANSWER", "", null, 1])("rejects invalid type %s", type => expect(() => parse({ type })).toThrow());
  it.each(Object.values(QuestionDifficulty))("accepts difficulty %s", difficulty => expect(parse({ difficulty }).difficulty).toBe(difficulty));
  it.each(["medium", null, undefined, 1])("rejects difficulty %s", difficulty => expect(() => parse({ difficulty })).toThrow());
  it.each([null, [], "text", 1, true, new Date()])("rejects non-record input %s", input => expect(() => validateCreateQuestionInput(input)).toThrow());
  it.each(["", " \n ", null, 1, "x".repeat(5001)])("rejects invalid question %#", text => expect(() => parse({ text })).toThrow());
  it.each([1, 5000])("accepts question length %s after trimming", size => expect(parse({ text: ` ${"x".repeat(size)} ` }).text).toHaveLength(size));
  it("normalizes blank explanation to null", () => expect(parse({ explanation: " \n " }).explanation).toBeNull());
  it("trims explanation at its boundary", () => expect(parse({ explanation: ` ${"x".repeat(5000)} ` }).explanation).toHaveLength(5000));
  it.each([null, 1, "x".repeat(5001)])("rejects invalid explanation %#", explanation => expect(() => parse({ explanation })).toThrow());
  it.each([undefined, null, "objective-1"])("accepts optional objective %s", learningObjectiveId => {
    expect(parse({ learningObjectiveId }).learningObjectiveId).toBe(learningObjectiveId ?? null);
  });
  it("trims an objective identifier", () => expect(parse({ learningObjectiveId: " objective-1 " }).learningObjectiveId).toBe("objective-1"));
  it.each(["lessonId", "learningObjectiveId"])("rejects blank and non-string %s", field => {
    for (const value of [" ", 12, {}]) expect(() => parse({ [field]: value })).toThrow(QuestionValidationError);
  });
  it("requires a lesson identifier", () => expect(() => parse({ lessonId: undefined })).toThrow());
  it.each([0, 1, 7])("rejects MCQ option count %s", count => {
    expect(() => parse({ options: Array.from({ length: count }, (_, i) => ({ text: String(i), isCorrect: i === 0 })) })).toThrow();
  });
  it("accepts six options and derives all sort orders", () => {
    const options = Array.from({ length: 6 }, (_, i) => ({ text: String(i), isCorrect: i === 3 }));
    expect(parse({ options }).options.map(o => o.sortOrder)).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it.each([1, 3])("rejects true/false option count %s", count => {
    expect(() => parse({ type: "TRUE_FALSE", options: Array.from({ length: count }, (_, i) => ({ text: String(i), isCorrect: i === 0 })) })).toThrow();
  });
  it.each(["MULTIPLE_CHOICE", "TRUE_FALSE"])("requires exactly one correct answer for %s", type => {
    for (const correct of [false, true]) expect(() => parse({ type, options: valid().options.map(o => ({ ...o, isCorrect: correct })) })).toThrow();
  });
  it.each(["", " ", null, 1, "x".repeat(501)])("rejects invalid option text %#", text => {
    expect(() => parse({ options: [{ text, isCorrect: true }, valid().options[1]] })).toThrow();
  });
  it("accepts a trimmed 500-character option", () => expect(parse({ options: [
    { text: ` ${"x".repeat(500)} `, isCorrect: true }, valid().options[1],
  ] }).options[0].text).toHaveLength(500));
  it.each(["true", 1, null, undefined])("rejects non-boolean correctness %s", isCorrect => {
    expect(() => parse({ options: [{ text: "خيار", isCorrect }, valid().options[1]] })).toThrow();
  });
  it.each(["خيار واحد", " خيار واحد ", "خيار \n\t واحد"])("rejects duplicate text %s", duplicate => {
    expect(() => parse({ options: [{ text: "خيار واحد", isCorrect: true }, { text: duplicate, isCorrect: false }] })).toThrow();
  });
  it("preserves Arabic letters and diacritics in comparison", () => {
    expect(normalizeOptionText("  أَثر \n البيئة  ")).toBe("أَثر البيئة");
    expect(parse({ options: [{ text: "أثر", isCorrect: true }, { text: "اثر", isCorrect: false }] }).options).toHaveLength(2);
  });
  it.each([null, {}, [null, null], Array(2)])("rejects malformed options %#", options => expect(() => parse({ options })).toThrow());
  it.each(["createdById", "source", "status", "reviewedById", "conceptId", "createdAt", "updatedAt", "id", "points", "sortOrder", "correctAnswer", "correctOptionId", "extra"])
    ("rejects internal or unknown field %s", field => expect(() => parse({ [field]: "injected" })).toThrow(QuestionValidationError));
  it("rejects client option IDs and sort order", () => {
    for (const field of ["id", "questionId", "sortOrder", "extra"]) {
      expect(() => parse({ options: [{ ...valid().options[0], [field]: 99 }, valid().options[1]] })).toThrow();
    }
  });
  it("rejects inherited input fields", () => expect(() => validateCreateQuestionInput(Object.create(valid()))).toThrow());
});
