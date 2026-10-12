import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QuestionListInput } from "./question-read-query";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), find: vi.fn(), count: vi.fn(), grades: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/auth/authorization", () => ({ requireAdmin: mocks.auth }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { question: { findMany: mocks.find, count: mocks.count }, grade: { findMany: mocks.grades }, $transaction: mocks.transaction } }));
import { getQuestionFilterCurriculum, listQuestions } from "./question-service";
import { parseQuestionQuery, QuestionReadValidationError } from "./question-read-query";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ id: "admin" }); mocks.find.mockResolvedValue([]); mocks.count.mockResolvedValue(0);
  mocks.transaction.mockImplementation((operations: Promise<unknown>[]) => Promise.all(operations));
  mocks.grades.mockResolvedValue([]);
});
describe("question reads", () => {
  it("returns empty results with safe defaults", async () => {
    expect(await listQuestions()).toEqual({ questions: [], total: 0, page: 1, pageSize: 20, totalPages: 0 });
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 20, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }));
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Array), { isolationLevel: "RepeatableRead" });
  });
  it("calculates offset and total pages", async () => {
    mocks.count.mockResolvedValue(51);
    expect(await listQuestions({ page: 2, pageSize: 10 })).toMatchObject({ total: 51, totalPages: 6, page: 2, pageSize: 10 });
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10 }));
  });
  it.each([{ page: 0 }, { page: -1 }, { page: 1.5 }, { page: 10001 }, { page: Infinity }, { pageSize: 0 }, { pageSize: 51 }, { pageSize: 1.2 }])
    ("rejects invalid pagination %j before DB access", async input => {
      await expect(listQuestions(input)).rejects.toBeInstanceOf(QuestionReadValidationError);
      expect(mocks.find).not.toHaveBeenCalled();
    });
  it("accepts the maximum page size", async () => {
    await listQuestions({ pageSize: 50 }); expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }));
  });
  it.each([
    [{ lessonId: "l" }, { lesson: { id: "l", unit: { semester: {} } } }],
    [{ unitId: "u" }, { lesson: { unit: { id: "u", semester: {} } } }],
    [{ semesterId: "s" }, { lesson: { unit: { semester: { id: "s" } } } }],
    [{ gradeId: "g" }, { lesson: { unit: { semester: { gradeId: "g" } } } }],
    [{ type: "TRUE_FALSE" }, { type: "TRUE_FALSE", lesson: { unit: { semester: {} } } }],
    [{ difficulty: "HARD" }, { difficulty: "HARD", lesson: { unit: { semester: {} } } }],
  ])("applies filter %j to both count and rows", async (input, where) => {
    await listQuestions(input as QuestionListInput);
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ where }));
    expect(mocks.count).toHaveBeenCalledWith({ where });
  });
  it("intersects all curriculum filters instead of overriding parents", async () => {
    await listQuestions({ gradeId: "g", semesterId: "s", unitId: "u", lessonId: "l", type: "MULTIPLE_CHOICE", difficulty: "EASY" });
    expect(mocks.count).toHaveBeenCalledWith({ where: { type: "MULTIPLE_CHOICE", difficulty: "EASY", lesson: { id: "l", unit: { id: "u", semester: { id: "s", gradeId: "g" } } } } });
  });
  it("returns only an option count and does not select answers or user records", async () => {
    mocks.find.mockResolvedValue([{ id: "q", text: "سؤال", _count: { options: 2 } }]); mocks.count.mockResolvedValue(1);
    expect((await listQuestions()).questions).toEqual([{ id: "q", text: "سؤال", optionCount: 2 }]);
    const select = mocks.find.mock.calls[0][0].select;
    expect(select._count).toEqual({ select: { options: true } });
    for (const field of ["options", "createdBy", "reviewedBy", "createdById", "matchingPairs", "assessmentLinks"]) expect(select).not.toHaveProperty(field);
    expect(JSON.stringify(select)).not.toContain("isCorrect");
  });
  it("propagates database failures", async () => {
    mocks.transaction.mockRejectedValue(new Error("database failure"));
    await expect(listQuestions()).rejects.toThrow("database failure");
  });
  it("protects both public services before reading", async () => {
    mocks.auth.mockRejectedValue(new Error("forbidden"));
    await expect(listQuestions()).rejects.toThrow("forbidden");
    await expect(getQuestionFilterCurriculum()).rejects.toThrow("forbidden");
    expect(mocks.find).not.toHaveBeenCalled(); expect(mocks.grades).not.toHaveBeenCalled();
  });
  it("reads a lightweight ordered curriculum for filters", async () => {
    expect(await getQuestionFilterCurriculum()).toEqual([]);
    const query = mocks.grades.mock.calls[0][0];
    expect(query.orderBy).toEqual([{ sortOrder: "asc" }, { id: "asc" }]);
    expect(JSON.stringify(query)).not.toMatch(/lessonResources|isCorrect|learningObjectives/);
  });
});
describe("question query parsing", () => {
  it.each(["page=0", "page=-1", "page=1.5", "page=1e2", "page=10001", "page=99999999999999999999", "pageSize=0", "pageSize=51", "pageSize=", "type=MULTIPLE_SELECT", "type=MATCHING", "difficulty=medium", "lessonId=", "page=1&page=2", "unknown=x"])
    ("rejects %s", query => expect(() => parseQuestionQuery(new URLSearchParams(query))).toThrow(QuestionReadValidationError));
  it("parses valid typed query values", () => {
    expect(parseQuestionQuery(new URLSearchParams("page=2&pageSize=50&lessonId=l&type=TRUE_FALSE&difficulty=MEDIUM")))
      .toEqual({ page: 2, pageSize: 50, lessonId: "l", type: "TRUE_FALSE", difficulty: "MEDIUM" });
  });
});
