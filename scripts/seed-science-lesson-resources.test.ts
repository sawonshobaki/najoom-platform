import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../src/generated/prisma/client";
import { scienceLessonResources, RESOURCE_ACADEMIC_YEAR, type ScienceLessonResource } from "./science-lesson-resources-data";
import { seedScienceLessonResources, validateScienceLessonResources } from "./seed-science-lesson-resources";
import { parseSeedArgs } from "./seed-science-curriculum";

const options = { apply: false, databaseUrl: "postgresql://127.0.0.1:5432/najoom_dev", nodeEnv: "development" };
const copyData = () => structuredClone(scienceLessonResources);
type SavedResource = Pick<ScienceLessonResource, "title" | "url" | "type" | "language" | "isFree" | "sortOrder" | "instructionsArabic"> & { id: string; lessonId: string };
const paths = scienceLessonResources.filter((item, index, all) => all.findIndex(other => other.lesson === item.lesson) === index);

function database() {
  const rows: SavedResource[] = [];
  const targets = paths.map((item, index) => ({ id: `lesson-${index}`, title: item.lesson, unit: {
    title: item.unit, semester: { name: item.semester, academicYear: RESOURCE_ACADEMIC_YEAR, grade: { name: item.grade } },
  } }));
  const lesson = { findMany: vi.fn(async ({ where }: { where: Omit<typeof targets[number], "id"> }) =>
    targets.filter(target => JSON.stringify({ title: target.title, unit: target.unit }) === JSON.stringify(where)).map(target => ({ id: target.id }))) };
  const lessonResource = {
    findMany: vi.fn(async ({ where }: { where: { lessonId: string; OR: [{ url: string }, { sortOrder: number }] } }) => rows.filter(row =>
      row.lessonId === where.lessonId && (row.url === where.OR[0].url || row.sortOrder === where.OR[1].sortOrder))),
    create: vi.fn(async ({ data }: { data: Omit<SavedResource, "id"> }) => {
      const row = { ...data, id: `resource-${rows.length + 1}` }; rows.push(row); return row;
    }),
  };
  const execute = vi.fn(async (query: TemplateStringsArray) => { expect(query[0]).toBeTruthy(); return 0; });
  const transaction = vi.fn(async (callback: (tx: PrismaClient) => Promise<unknown>, settings: { isolationLevel: string }) => {
    expect(settings.isolationLevel).toBe("Serializable");
    const before = structuredClone(rows);
    try { return await callback(client); }
    catch (error) { rows.splice(0, rows.length, ...before); throw error; }
  });
  const client = { lesson, lessonResource, $executeRaw: execute, $transaction: transaction } as unknown as PrismaClient;
  return { client, rows, targets, lesson, lessonResource, transaction, execute };
}

describe("first official lesson resources", () => {
  it("contains exactly five resources across the four approved lessons", () => {
    expect(validateScienceLessonResources(scienceLessonResources)).toEqual({ resources: 5, lessons: 4 });
    expect(paths.map(path => scienceLessonResources.filter(row => row.lesson === path.lesson).length)).toEqual([1, 1, 1, 2]);
    expect(scienceLessonResources.filter(row => row.lesson === "الفضاء والكون").map(row => row.sortOrder)).toEqual([1, 2]);
    expect(scienceLessonResources.some(row => ["الخلية", "النظام البيئي"].includes(row.lesson))).toBe(false);
  });
  it.each(["http", "unknown host", "lookalike host", "wrong approved host", "credentials", "invalid URL"])("rejects %s", kind => {
    const data = copyData();
    const urls: Record<string, string> = {
      http: "http://phet.colorado.edu/activity", "unknown host": "https://example.org/activity",
      "lookalike host": "https://phet.colorado.edu.example.org/activity", "wrong approved host": "https://spaceplace.nasa.gov/activity",
      credentials: "https://user:secret@phet.colorado.edu/activity", "invalid URL": "not a URL",
    };
    data[0].url = urls[kind];
    expect(() => validateScienceLessonResources(data)).toThrow(/رابط/);
  });
  it("rejects missing data and duplicate input URLs or positions", () => {
    expect(() => validateScienceLessonResources(copyData().slice(0, 4))).toThrow(/5/);
    const data = copyData(); data[4].url = data[3].url;
    expect(() => validateScienceLessonResources(data)).toThrow(/مكرر/);
    const orders = copyData(); orders[4].sortOrder = 1;
    expect(() => validateScienceLessonResources(orders)).toThrow(/مكرر/);
  });
  it("resolves full paths including the academic year and performs a read-only dry run", async () => {
    const db = database();
    const summary = await seedScienceLessonResources(db.client, copyData(), options);
    expect(summary).toMatchObject({ totals: { resources: 5, lessons: 4 }, create: 5, matched: 0 });
    expect(summary.lessons.map(row => row.resources)).toEqual([1, 1, 1, 2]);
    expect(db.lesson.findMany.mock.calls[0][0].where).toEqual({ title: "الذرات والجزيئات", unit: {
      title: "المادة", semester: { name: "الفصل الدراسي الأول", academicYear: "2026-2027", grade: { name: "الصف السادس" } },
    } });
    expect(db.lessonResource.create).not.toHaveBeenCalled();
    expect(db.rows).toEqual([]);
    expect(db.execute.mock.calls[0][0]).toEqual(["SET TRANSACTION READ ONLY"]);
  });
  it("fails if a target lesson is missing before inserting anything", async () => {
    const db = database(); db.targets.pop();
    await expect(seedScienceLessonResources(db.client, copyData(), { ...options, apply: true })).rejects.toThrow(/الدرس غير موجود/);
    expect(db.lessonResource.create).not.toHaveBeenCalled();
  });
  it("rejects an ambiguous full lesson path", async () => {
    const db = database(); db.targets.push({ ...db.targets[0], id: "ambiguous-lesson" });
    await expect(seedScienceLessonResources(db.client, copyData(), options)).rejects.toThrow(/ملتبس/);
  });
  it("matches using parent titles rather than a similarly titled lesson in another unit", async () => {
    const db = database(); db.targets.push({ ...db.targets[0], id: "other-unit", unit: { ...db.targets[0].unit, title: "وحدة أخرى" } });
    await seedScienceLessonResources(db.client, copyData(), { ...options, apply: true });
    expect(db.rows[0].lessonId).toBe("lesson-0");
  });
  it("is idempotent, preserves IDs and locks inserts in a serializable transaction", async () => {
    const db = database();
    await seedScienceLessonResources(db.client, copyData(), { ...options, apply: true });
    const before = structuredClone(db.rows);
    expect(await seedScienceLessonResources(db.client, copyData(), { ...options, apply: true })).toMatchObject({ create: 0, matched: 5 });
    expect(db.rows).toEqual(before);
    expect(db.rows).toHaveLength(5);
    expect(db.execute.mock.calls[0][0]).toEqual(['LOCK TABLE "lesson_resources" IN SHARE ROW EXCLUSIVE MODE']);
    expect(db.transaction.mock.calls[0][1]).toMatchObject({ isolationLevel: "Serializable" });
  });
  it.each(["title", "type", "language", "isFree", "sortOrder", "instructionsArabic"] as const)("fails without overwriting a changed %s", async field => {
    const db = database(); await seedScienceLessonResources(db.client, copyData(), { ...options, apply: true });
    Object.assign(db.rows[0], { [field]: field === "isFree" ? false : field === "sortOrder" ? 3 : "different" });
    const before = structuredClone(db.rows);
    await expect(seedScienceLessonResources(db.client, copyData(), { ...options, apply: true })).rejects.toThrow(/تعارض/);
    expect(db.rows).toEqual(before);
  });
  it("rejects a duplicate already present in the database", async () => {
    const db = database(); await seedScienceLessonResources(db.client, copyData(), { ...options, apply: true });
    db.rows.push({ ...db.rows[0], id: "duplicate" });
    await expect(seedScienceLessonResources(db.client, copyData(), options)).rejects.toThrow(/تعارض/);
  });
  it("rejects a different URL occupying the same position", async () => {
    const db = database(); await seedScienceLessonResources(db.client, copyData(), { ...options, apply: true });
    db.rows[0].url = "https://phet.colorado.edu/other";
    await expect(seedScienceLessonResources(db.client, copyData(), options)).rejects.toThrow(/تعارض/);
  });
  it("rolls back earlier inserts after an unexpected database error", async () => {
    const db = database();
    db.lessonResource.create.mockImplementationOnce(async ({ data }) => {
      const row = { ...data, id: "first" }; db.rows.push(row); return row;
    }).mockRejectedValueOnce(new Error("database failure"));
    await expect(seedScienceLessonResources(db.client, copyData(), { ...options, apply: true })).rejects.toThrow("database failure");
    expect(db.rows).toEqual([]);
    expect(db.transaction).toHaveBeenCalledTimes(1);
  });
  it.each([
    { ...options, nodeEnv: "production" },
    { ...options, databaseUrl: "postgresql://remote.example:5432/najoom_dev" },
    { ...options, databaseUrl: "postgresql://127.0.0.1:5432/najoom_production" },
  ])("rejects a production or nonlocal target before any queries", async forbidden => {
    const db = database();
    await expect(seedScienceLessonResources(db.client, copyData(), forbidden)).rejects.toThrow();
    expect(db.transaction).not.toHaveBeenCalled();
  });
  it("defaults to dry run and rejects conflicting or unknown CLI flags", () => {
    expect(parseSeedArgs([])).toEqual({ apply: false });
    expect(parseSeedArgs(["--dry-run"])).toEqual({ apply: false });
    expect(parseSeedArgs(["--apply"])).toEqual({ apply: true });
    expect(() => parseSeedArgs(["--dry-run", "--apply"])).toThrow();
    expect(() => parseSeedArgs(["--force"])).toThrow();
  });
});
