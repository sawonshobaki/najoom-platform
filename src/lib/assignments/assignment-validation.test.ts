import { describe, expect, it } from "vitest";
import { validateExternalAssignmentCreate } from "./assignment-validation";

const valid = () => ({ lessonId: " lesson-1 ", title: " واجب الخلية ", externalUrl: "https://example.edu/task", weekNumber: 1 });
describe("external assignment validation", () => {
  it("creates with a title only and normalizes optional instructions", () => expect(validateExternalAssignmentCreate(valid())).toEqual({ lessonId: "lesson-1", title: "واجب الخلية", description: null, externalUrl: "https://example.edu/task", weekNumber: 1 }));
  it("keeps trimmed assignment instructions", () => expect(validateExternalAssignmentCreate({ ...valid(), description: " اقرئي السؤال ثم أجيبي. " }).description).toBe("اقرئي السؤال ثم أجيبي."));
  it.each(["", "   ", null])("stores empty description %j as null", description => expect(validateExternalAssignmentCreate({ ...valid(), description }).description).toBeNull());
  it.each(["", " ", null, 3])("rejects missing title %j", title => expect(() => validateExternalAssignmentCreate({ ...valid(), title })).toThrow());
  it.each([0, -1, 1.5, "1", null])("rejects invalid week %j", weekNumber => expect(() => validateExternalAssignmentCreate({ ...valid(), weekNumber })).toThrow("عددًا صحيحًا موجبًا"));
  it("accepts any valid HTTPS host", () => expect(validateExternalAssignmentCreate({ ...valid(), externalUrl: "https://forms.google.com/example?q=1" }).externalUrl).toBe("https://forms.google.com/example?q=1"));
  it.each(["http://example.com", "javascript:alert(1)", "data:text/plain,x", "file:///tmp/x", "not a url", "https://user:pass@example.com/"])("rejects unsafe URL %s", externalUrl => expect(() => validateExternalAssignmentCreate({ ...valid(), externalUrl })).toThrow());
  it.each([null, [], "body", 4])("rejects invalid body %j", input => expect(() => validateExternalAssignmentCreate(input)).toThrow());
  it.each(["createdById", "gradeId", "sectionId", "status", "prompt", "maxScore", "dueAt"])("rejects internal field %s", field => expect(() => validateExternalAssignmentCreate({ ...valid(), [field]: "forged" })).toThrow("غير مسموحة"));
});
