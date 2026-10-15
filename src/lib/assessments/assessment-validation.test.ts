import { describe, expect, it } from "vitest";
import { MAX_ASSESSMENT_QUESTIONS, validateAssessmentCreateRequest } from "./assessment-validation";

describe("assessment create validation", () => {
  const valid = () => ({ title: " اختبار الخلية ", lessonId: " lesson-1 ", questionIds: [" q1 ", "q2"] });

  it("normalizes the public V1 contract", () => {
    expect(validateAssessmentCreateRequest(valid())).toEqual({ title: "اختبار الخلية", lessonId: "lesson-1", questionIds: ["q1", "q2"] });
  });
  it.each([null, [], "body", 1, false])("rejects a non-object body %j", input => {
    expect(() => validateAssessmentCreateRequest(input)).toThrow("بيانات الاختبار غير صالحة");
  });
  it.each(["", "   ", "x".repeat(201), null])("rejects invalid titles %j", title => {
    expect(() => validateAssessmentCreateRequest({ ...valid(), title })).toThrow();
  });
  it.each(["", " ", null, 2])("rejects invalid lesson IDs %j", lessonId => {
    expect(() => validateAssessmentCreateRequest({ ...valid(), lessonId })).toThrow();
  });
  it("requires one to fifty questions", () => {
    expect(() => validateAssessmentCreateRequest({ ...valid(), questionIds: [] })).toThrow();
    expect(validateAssessmentCreateRequest({ ...valid(), questionIds: Array.from({ length: MAX_ASSESSMENT_QUESTIONS }, (_, i) => `q${i}`) }).questionIds).toHaveLength(50);
    expect(() => validateAssessmentCreateRequest({ ...valid(), questionIds: Array.from({ length: 51 }, (_, i) => `q${i}`) })).toThrow();
  });
  it("rejects duplicate normalized question IDs", () => {
    expect(() => validateAssessmentCreateRequest({ ...valid(), questionIds: ["q1", " q1 "] })).toThrow("تكرار");
  });
  it.each(["gradeId", "type", "durationSeconds", "status", "createdById", "questions", "sectionId", "startsAt"])("rejects internal field %s", field => {
    expect(() => validateAssessmentCreateRequest({ ...valid(), [field]: "forged" })).toThrow("غير مسموحة");
  });
});
