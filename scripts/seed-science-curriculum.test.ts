import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../src/generated/prisma/client";
import { scienceCurriculum } from "./science-curriculum-data";
import { EXPECTED_COUNTS, parseSeedArgs, requireDevelopmentDatabase, seedScienceCurriculum, validateScienceCurriculum } from "./seed-science-curriculum";

const devOptions = { apply: false, databaseUrl: "postgresql://127.0.0.1:5432/najoom_dev", nodeEnv: "development" };
const copyData = () => structuredClone(scienceCurriculum);

type Grade = { id: string; name: string; sortOrder: number };
type Semester = { id: string; gradeId: string; name: string; academicYear: string; sortOrder: number };
type Unit = { id: string; semesterId: string; title: string; sortOrder: number; description?: string };
type Lesson = { id: string; unitId: string; title: string; sortOrder: number; description?: string };

// An in-memory test double exercises repeat runs and rollback without connecting to PostgreSQL.
function database() {
  const state: { grades: Grade[]; semesters: Semester[]; units: Unit[]; lessons: Lesson[] } = { grades: [], semesters: [], units: [], lessons: [] };
  let sequence = 0;
  function save<T extends { id: string }>(rows: T[], match: (row: T) => boolean, create: Omit<T, "id">): T {
    const existing = rows.find(match);
    if (existing) return existing;
    const row = { ...create, id: `generated-${++sequence}` } as T;
    rows.push(row);
    return row;
  }
  const grade = {
    findUnique: vi.fn(async ({ where }: { where: { name: string } }) => {
      const row = state.grades.find((item) => item.name === where.name);
      return row ? { ...row, semesters: state.semesters.filter((item) => item.gradeId === row.id && item.academicYear === "2026-2027").map((semester) => ({
        ...semester, units: state.units.filter((item) => item.semesterId === semester.id).map((unit) => ({
          ...unit, lessons: state.lessons.filter((item) => item.unitId === unit.id),
        })),
      })) } : null;
    }),
    upsert: vi.fn(async ({ where, create, update }: { where: { name: string }; create: Omit<Grade, "id">; update: object }) => {
      expect(update).toEqual({});
      return save(state.grades, (row) => row.name === where.name, create);
    }),
  };
  const semester = { upsert: vi.fn(async ({ where, create, update }: {
    where: { gradeId_academicYear_sortOrder: { gradeId: string; academicYear: string; sortOrder: number } }; create: Omit<Semester, "id">; update: object;
  }) => {
    expect(update).toEqual({});
    const key = where.gradeId_academicYear_sortOrder;
    return save(state.semesters, (row) => row.gradeId === key.gradeId && row.academicYear === key.academicYear && row.sortOrder === key.sortOrder, create);
  }) };
  const unit = { upsert: vi.fn(async ({ where, create, update }: {
    where: { semesterId_sortOrder: { semesterId: string; sortOrder: number } }; create: Omit<Unit, "id">; update: object;
  }) => {
    expect(update).toEqual({});
    const key = where.semesterId_sortOrder;
    return save(state.units, (row) => row.semesterId === key.semesterId && row.sortOrder === key.sortOrder, create);
  }) };
  const lesson = { upsert: vi.fn(async ({ where, create, update }: {
    where: { unitId_sortOrder: { unitId: string; sortOrder: number } }; create: Omit<Lesson, "id">; update: object;
  }) => {
    expect(update).toEqual({});
    const key = where.unitId_sortOrder;
    return save(state.lessons, (row) => row.unitId === key.unitId && row.sortOrder === key.sortOrder, create);
  }) };
  const transaction = vi.fn(async (callback: (tx: PrismaClient) => Promise<unknown>) => {
    const before = structuredClone(state);
    try { return await callback(client); }
    catch (error) { Object.assign(state, before); throw error; }
  });
  const client = { grade, semester, unit, lesson, $transaction: transaction } as unknown as PrismaClient;
  return { client, state, grade, semester, unit, lesson, transaction };
}

describe("official science curriculum data", () => {
  it("has exactly 2 grades, 4 semesters, 19 units and 41 lessons", () => {
    expect(validateScienceCurriculum(scienceCurriculum)).toEqual(EXPECTED_COUNTS);
    expect(scienceCurriculum.flatMap((grade) => grade.semesters).map((semester) => semester.units.reduce((count, unit) => count + unit.lessons.length, 0))).toEqual([11, 11, 9, 10]);
  });
  it("preserves the supplied Arabic punctuation and titles", () => {
    expect(scienceCurriculum[0].semesters[1].units[1].lessons.map((lesson) => lesson.title)).toEqual([
      "الجهاز الهضمي، والجهاز البولي", "الجهاز التنفسي، وجهاز الدوران", "الجهاز الهيكلي، والجهاز العضلي",
    ]);
    expect(scienceCurriculum[1].semesters[0].units[0].lessons[1].title).toBe("نقل المواد والعمليات الحيوية في الخلية");
  });
  it("rejects missing grades", () => { expect(() => validateScienceCurriculum(copyData().slice(0, 1))).toThrow(); });
  it("rejects a missing unit", () => {
    const data = copyData(); data[0].semesters[0].units.pop();
    expect(() => validateScienceCurriculum(data)).toThrow(/عدد/);
  });
  it("rejects a missing lesson", () => {
    const data = copyData(); data[0].semesters[0].units[0].lessons.pop();
    expect(() => validateScienceCurriculum(data)).toThrow(/عدد/);
  });
  it.each(["duplicate grade", "other grade", "third semester", "duplicate semester", "duplicate unit", "duplicate lesson", "empty unit", "empty lesson", "wrong year", "wrong semester name", "extra resource", "nonsequential order"])("rejects %s", (kind) => {
    const data = copyData();
    const semester = data[0].semesters[0];
    const unit = semester.units[0];
    if (kind === "duplicate grade") data[1] = structuredClone(data[0]);
    if (kind === "other grade") data[0].name = "الصف السابع";
    if (kind === "third semester") data[0].semesters.push(structuredClone(semester));
    if (kind === "duplicate semester") data[0].semesters[1].sortOrder = 1;
    if (kind === "duplicate unit") semester.units[1].sortOrder = 1;
    if (kind === "duplicate lesson") unit.lessons[1].sortOrder = 1;
    if (kind === "empty unit") unit.title = " ";
    if (kind === "empty lesson") unit.lessons[0].title = " ";
    if (kind === "wrong year") semester.academicYear = "2026/2027";
    if (kind === "wrong semester name") semester.name = "فصل آخر";
    if (kind === "extra resource") Object.assign(unit.lessons[0], { resources: [] });
    if (kind === "nonsequential order") unit.lessons[0].sortOrder = 3;
    expect(() => validateScienceCurriculum(data)).toThrow();
  });
  it.each([null, [], {}, "text"])("rejects invalid data %j", (data) => { expect(() => validateScienceCurriculum(data)).toThrow(); });
});

describe("development-only CLI", () => {
  it("defaults to preview and requires the exact apply flag", () => {
    expect(parseSeedArgs([])).toEqual({ apply: false });
    expect(parseSeedArgs(["--dry-run"])).toEqual({ apply: false });
    expect(parseSeedArgs(["--apply"])).toEqual({ apply: true });
  });
  it.each([["--force"], ["--apply=true"], ["--apply", "--dry-run"], ["--apply", "--apply"]])("rejects ambiguous or unknown flags %j", (...args) => {
    expect(() => parseSeedArgs(args)).toThrow();
  });
  it("accepts only the designated local development connection", () => {
    expect(() => requireDevelopmentDatabase(devOptions.databaseUrl, "development")).not.toThrow();
  });
  it.each([undefined, "bad-url", "postgresql://production.example.com/najoom_dev", "postgresql://127.0.0.1/production", "postgresql://127.0.0.1:5433/najoom_dev", "https://127.0.0.1/najoom_dev"])("rejects unsafe connection %j", (url) => {
    expect(() => requireDevelopmentDatabase(url, "development")).toThrow();
  });
  it("rejects NODE_ENV production even with a local URL", () => {
    expect(() => requireDevelopmentDatabase(devOptions.databaseUrl, "production")).toThrow(/production/);
  });
});

describe("safe seeding logic with a mocked database", () => {
  it("preview reads matches and missing rows without any writes", async () => {
    const db = database();
    const summary = await seedScienceCurriculum(db.client, scienceCurriculum, devOptions);
    expect(summary).toEqual({ totals: EXPECTED_COUNTS, create: EXPECTED_COUNTS, matched: { grades: 0, semesters: 0, units: 0, lessons: 0 } });
    expect(db.transaction).not.toHaveBeenCalled();
    for (const model of [db.grade, db.semester, db.unit, db.lesson]) expect(model.upsert).not.toHaveBeenCalled();
    expect(db.state).toEqual({ grades: [], semesters: [], units: [], lessons: [] });
  });
  it("validates data and development guards before any database access", async () => {
    const db = database();
    await expect(seedScienceCurriculum(db.client, [], devOptions)).rejects.toThrow();
    await expect(seedScienceCurriculum(db.client, scienceCurriculum, { ...devOptions, nodeEnv: "production" })).rejects.toThrow();
    expect(db.grade.findUnique).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });
  it("is idempotent, preserves IDs and descriptions, and uses one transaction per run", async () => {
    const db = database();
    await seedScienceCurriculum(db.client, scienceCurriculum, { ...devOptions, apply: true });
    expect(Object.fromEntries(Object.entries(db.state).map(([key, rows]) => [key, rows.length]))).toEqual(EXPECTED_COUNTS);
    db.state.grades[0].sortOrder = 55; // Reuse an existing named grade without changing it.
    db.state.units[0].description = "وصف موجود";
    db.state.lessons[0].description = "شرح موجود";
    const before = structuredClone(db.state);
    const summary = await seedScienceCurriculum(db.client, scienceCurriculum, { ...devOptions, apply: true });
    expect(db.state).toEqual(before);
    expect(summary.matched).toEqual(EXPECTED_COUNTS);
    expect(summary.create).toEqual({ grades: 0, semesters: 0, units: 0, lessons: 0 });
    expect(db.transaction).toHaveBeenCalledTimes(2);
    expect(db.transaction.mock.calls[0]).toHaveLength(2);
    const call = vi.mocked(db.client.$transaction).mock.calls[0];
    expect(call[1]).toMatchObject({ isolationLevel: "Serializable" });
  });
  it.each(["semester", "unit", "lesson"])("fails without changes for an occupied %s position", async (kind) => {
    const db = database();
    await seedScienceCurriculum(db.client, scienceCurriculum, { ...devOptions, apply: true });
    if (kind === "semester") db.state.semesters[0].name = "اسم مختلف";
    if (kind === "unit") db.state.units[0].title = "عنوان مختلف";
    if (kind === "lesson") db.state.lessons[0].title = "عنوان مختلف";
    const before = structuredClone(db.state);
    await expect(seedScienceCurriculum(db.client, scienceCurriculum, devOptions)).rejects.toThrow(/تعارض/);
    await expect(seedScienceCurriculum(db.client, scienceCurriculum, { ...devOptions, apply: true })).rejects.toThrow(/تعارض/);
    expect(db.state).toEqual(before);
  });
  it("rolls back earlier creations on a late write failure", async () => {
    const db = database();
    db.lesson.upsert.mockRejectedValueOnce(new Error("Write failed"));
    await expect(seedScienceCurriculum(db.client, scienceCurriculum, { ...devOptions, apply: true })).rejects.toThrow("Write failed");
    expect(db.state).toEqual({ grades: [], semesters: [], units: [], lessons: [] });
  });
  it("keeps extra existing rows and other academic years untouched", async () => {
    const db = database();
    db.state.grades.push({ id: "existing", name: "الصف الخامس", sortOrder: 5 });
    db.state.semesters.push({ id: "past", gradeId: "existing", name: "الفصل الدراسي الأول", academicYear: "2025-2026", sortOrder: 1 });
    db.state.units.push({ id: "extra", semesterId: "past", title: "وحدة موجودة", sortOrder: 1 });
    await seedScienceCurriculum(db.client, scienceCurriculum, { ...devOptions, apply: true });
    expect(db.state.grades.filter((row) => row.name === "الصف الخامس")).toHaveLength(1);
    expect(db.state.semesters).toContainEqual({ id: "past", gradeId: "existing", name: "الفصل الدراسي الأول", academicYear: "2025-2026", sortOrder: 1 });
    expect(db.state.units).toContainEqual({ id: "extra", semesterId: "past", title: "وحدة موجودة", sortOrder: 1 });
  });
});
