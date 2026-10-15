import { describe, expect, it } from "vitest";
import { validateAssignmentScore } from "./assignment-review-validation";

describe("validateAssignmentScore", () => {
  it.each([0, 1] as const)("accepts score %s", score => expect(validateAssignmentScore({ score })).toBe(score));
  it.each([2, -1, 0.5, "1", null, [], {}, { score: 1, reviewerId: "forged" }])("rejects invalid or extra input %#", input => {
    expect(() => validateAssignmentScore(input)).toThrow();
  });
});
