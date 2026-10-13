import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), find: vi.fn(), count: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/auth/authorization", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/auth/authorization")>(), requireAdmin: mocks.auth }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { question: { findMany: mocks.find, count: mocks.count }, $transaction: mocks.transaction } }));
import { AuthenticationRequiredError, AuthorizationDeniedError } from "@/lib/auth/authorization";
import * as route from "./route";
const request = (query = "") => route.GET(new Request(`http://localhost/api/admin/questions?${query}`));
beforeEach(() => {
  vi.resetAllMocks(); mocks.auth.mockResolvedValue({ id: "admin" }); mocks.find.mockResolvedValue([]); mocks.count.mockResolvedValue(0);
  mocks.transaction.mockImplementation((operations: Promise<unknown>[]) => Promise.all(operations));
});
afterEach(() => vi.restoreAllMocks());
describe("GET admin questions", () => {
  it.each([[new AuthenticationRequiredError(), 401], [new AuthorizationDeniedError(), 403]] as const)("requires admin before query validation", async (error, status) => {
    mocks.auth.mockRejectedValue(error);
    expect((await request("page=bad")).status).toBe(status); expect(mocks.find).not.toHaveBeenCalled();
  });
  it("returns the empty result shape with private no-store caching", async () => {
    const response = await request(); expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ success: true, questions: [], total: 0, page: 1, pageSize: 20, totalPages: 0 });
  });
  it.each(["page=bad", "page=0", "pageSize=51", "pageSize=2.5", "type=MULTIPLE_SELECT", "type=SHORT_ANSWER", "difficulty=unknown", "lessonId=", "gradeId=g&gradeId=x"])
    ("returns 400 for %s", async query => {
      const response = await request(query); expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ success: false, message: expect.any(String) });
      expect(mocks.find).not.toHaveBeenCalled();
    });
  it("passes all valid filters through to the database", async () => {
    expect((await request("gradeId=g&semesterId=s&unitId=u&lessonId=l&type=TRUE_FALSE&difficulty=HARD&page=2&pageSize=5")).status).toBe(200);
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ skip: 5, take: 5, where: {
      type: "TRUE_FALSE", difficulty: "HARD", lesson: { id: "l", unit: { id: "u", semester: { id: "s", gradeId: "g" } } },
    } }));
  });
  it("returns counts without answer payloads", async () => {
    mocks.find.mockResolvedValue([{ id: "q", text: "سؤال", _count: { options: 2 } }]); mocks.count.mockResolvedValue(1);
    const body = await (await request()).json();
    expect(body.questions).toEqual([{ id: "q", text: "سؤال", optionCount: 2 }]);
    expect(JSON.stringify(body)).not.toMatch(/isCorrect|_count/);
  });
  it("does not leak internal database errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.transaction.mockRejectedValue(new Error("database secret detail"));
    const response = await request(); expect(response.status).toBe(500);
    const body = await response.json(); expect(body.message).toBe("تعذر تحميل بنك الأسئلة. حاولي مرة أخرى.");
    expect(JSON.stringify(body)).not.toContain("secret");
  });
  it("exports GET and POST without update or delete", () => expect(Object.keys(route).sort()).toEqual(["GET", "POST"]));
});
