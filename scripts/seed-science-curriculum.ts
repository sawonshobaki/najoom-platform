import "dotenv/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { ACADEMIC_YEAR, scienceCurriculum, type GradeSeed } from "./science-curriculum-data";

class ScienceCurriculumSeedError extends Error {}

export const EXPECTED_COUNTS = { grades: 2, semesters: 4, units: 19, lessons: 41 } as const;
type Counts = { -readonly [K in keyof typeof EXPECTED_COUNTS]: number };
const emptyCounts = (): Counts => ({ grades: 0, semesters: 0, units: 0, lessons: 0 });

function record(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => !keys.includes(key))) {
    throw new ScienceCurriculumSeedError("بنية بيانات المنهج غير صالحة أو تحتوي حقولًا خارج النطاق.");
  }
  return value as Record<string, unknown>;
}
function items(value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length === 0) throw new ScienceCurriculumSeedError("قائمة بيانات المنهج فارغة أو غير صالحة.");
  return value;
}
function title(value: unknown, max = 150) {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new ScienceCurriculumSeedError("يوجد عنوان فارغ أو غير صالح في بيانات المنهج.");
}
function order(value: unknown, expected: number, used: Set<number>) {
  if (typeof value !== "number" || !Number.isInteger(value) || value !== expected || used.has(value)) {
    throw new ScienceCurriculumSeedError("ترتيب المنهج غير صالح أو مكرر؛ يجب أن يبدأ من 1 ويتبع ترتيب الكتاب داخل كل فصل ووحدة.");
  }
  used.add(value);
}

export function validateScienceCurriculum(data: unknown): Counts {
  const counts = emptyCounts();
  const grades = items(data);
  const gradeNames = new Set<string>();
  for (const value of grades) {
    const grade = record(value, ["name", "sortOrder", "semesters"]);
    if ((grade.name !== "الصف الخامس" && grade.name !== "الصف السادس") || gradeNames.has(grade.name)
      || grade.sortOrder !== (grade.name === "الصف الخامس" ? 5 : 6)) {
      throw new ScienceCurriculumSeedError("يجب إدخال الصفين الخامس والسادس فقط، دون تكرار.");
    }
    gradeNames.add(grade.name);
    counts.grades++;
    const semesters = items(grade.semesters);
    if (semesters.length !== 2) throw new ScienceCurriculumSeedError("يجب أن يحتوي كل صف على الفصلين الأول والثاني فقط.");
    const semesterOrders = new Set<number>();
    for (const [semesterIndex, semesterValue] of semesters.entries()) {
      const semester = record(semesterValue, ["name", "academicYear", "sortOrder", "units"]);
      order(semester.sortOrder, semesterIndex + 1, semesterOrders);
      if (semester.name !== (semesterIndex === 0 ? "الفصل الدراسي الأول" : "الفصل الدراسي الثاني")) {
        throw new ScienceCurriculumSeedError("اسم الفصل الدراسي غير مطابق للبيانات الرسمية.");
      }
      if (semester.academicYear !== ACADEMIC_YEAR) throw new ScienceCurriculumSeedError(`السنة الدراسية المطلوبة هي ${ACADEMIC_YEAR}.`);
      counts.semesters++;
      const unitOrders = new Set<number>();
      for (const [unitIndex, unitValue] of items(semester.units).entries()) {
        const unit = record(unitValue, ["title", "sortOrder", "lessons"]);
        title(unit.title);
        order(unit.sortOrder, unitIndex + 1, unitOrders);
        counts.units++;
        const lessonOrders = new Set<number>();
        for (const [lessonIndex, lessonValue] of items(unit.lessons).entries()) {
          const lesson = record(lessonValue, ["title", "sortOrder"]);
          title(lesson.title);
          order(lesson.sortOrder, lessonIndex + 1, lessonOrders);
          counts.lessons++;
        }
      }
    }
  }
  if (Object.keys(EXPECTED_COUNTS).some((key) => counts[key as keyof Counts] !== EXPECTED_COUNTS[key as keyof Counts])) {
    throw new ScienceCurriculumSeedError("عدد عناصر المنهج لا يطابق المطلوب: 2 صفوف، 4 فصول، 19 وحدة، 41 درسًا.");
  }
  return counts;
}

export function requireDevelopmentDatabase(databaseUrl: string | undefined, nodeEnv: string | undefined) {
  if (nodeEnv === "production") throw new ScienceCurriculumSeedError("يُمنع تشغيل سكربت المنهج في production.");
  if (!databaseUrl) throw new ScienceCurriculumSeedError("DATABASE_URL غير مضبوط لقاعدة التطوير.");
  let url: URL;
  try { url = new URL(databaseUrl); }
  catch { throw new ScienceCurriculumSeedError("رابط قاعدة التطوير غير صالح."); }
  if (!["postgresql:", "postgres:"].includes(url.protocol)
    || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
    || url.pathname !== "/najoom_dev" || (url.port && url.port !== "5432")) {
    throw new ScienceCurriculumSeedError("يُسمح بالتشغيل على PostgreSQL المحلي بقاعدة najoom_dev والمنفذ 5432 فقط.");
  }
}

type SeedReader = Pick<Prisma.TransactionClient, "grade">;
function checkMatching(actual: string | undefined, expected: string, context: string) {
  if (actual !== undefined && actual !== expected) {
    throw new ScienceCurriculumSeedError(`تعارض في ${context}: الموضع مشغول بعنوان «${actual}» بدل «${expected}». لم يُستبدل العنوان.`);
  }
}

async function inspectCurriculum(client: SeedReader, data: GradeSeed[]) {
  const summary = { totals: validateScienceCurriculum(data), create: emptyCounts(), matched: emptyCounts() };
  function count(kind: keyof Counts, exists: boolean) { (exists ? summary.matched : summary.create)[kind]++; }
  for (const grade of data) {
    const existing = await client.grade.findUnique({
      where: { name: grade.name },
      select: { id: true, semesters: {
        where: { academicYear: ACADEMIC_YEAR },
        select: { id: true, name: true, sortOrder: true, units: { select: {
          id: true, title: true, sortOrder: true, lessons: { select: { id: true, title: true, sortOrder: true } },
        } } },
      } },
    });
    count("grades", !!existing);
    for (const semester of grade.semesters) {
      const foundSemester = existing?.semesters.find((item) => item.sortOrder === semester.sortOrder);
      const context = `${grade.name} / ${semester.name}`;
      checkMatching(foundSemester?.name, semester.name, context);
      count("semesters", !!foundSemester);
      for (const unit of semester.units) {
        const foundUnit = foundSemester?.units.find((item) => item.sortOrder === unit.sortOrder);
        checkMatching(foundUnit?.title, unit.title, `${context} / الوحدة ${unit.sortOrder}`);
        count("units", !!foundUnit);
        for (const lesson of unit.lessons) {
          const foundLesson = foundUnit?.lessons.find((item) => item.sortOrder === lesson.sortOrder);
          checkMatching(foundLesson?.title, lesson.title, `${context} / ${unit.title} / الدرس ${lesson.sortOrder}`);
          count("lessons", !!foundLesson);
        }
      }
    }
  }
  return summary;
}

export async function seedScienceCurriculum(client: PrismaClient, data: GradeSeed[], options: {
  apply: boolean; databaseUrl: string | undefined; nodeEnv?: string;
}) {
  requireDevelopmentDatabase(options.databaseUrl, options.nodeEnv);
  validateScienceCurriculum(data);
  if (!options.apply) return inspectCurriculum(client, data);
  // Validate existing positions and write in the same serializable transaction.
  return client.$transaction(async (tx) => {
    const summary = await inspectCurriculum(tx, data);
    for (const grade of data) {
      const savedGrade = await tx.grade.upsert({
        where: { name: grade.name }, update: {}, create: { name: grade.name, sortOrder: grade.sortOrder }, select: { id: true },
      });
      for (const semester of grade.semesters) {
        const savedSemester = await tx.semester.upsert({
          where: { gradeId_academicYear_sortOrder: { gradeId: savedGrade.id, academicYear: semester.academicYear, sortOrder: semester.sortOrder } },
          update: {}, create: { gradeId: savedGrade.id, name: semester.name, academicYear: semester.academicYear, sortOrder: semester.sortOrder }, select: { id: true, name: true },
        });
        checkMatching(savedSemester.name, semester.name, `${grade.name} / الفصل ${semester.sortOrder}`);
        for (const unit of semester.units) {
          const savedUnit = await tx.unit.upsert({
            where: { semesterId_sortOrder: { semesterId: savedSemester.id, sortOrder: unit.sortOrder } },
            update: {}, create: { semesterId: savedSemester.id, title: unit.title, sortOrder: unit.sortOrder }, select: { id: true, title: true },
          });
          checkMatching(savedUnit.title, unit.title, `${grade.name} / ${semester.name} / الوحدة ${unit.sortOrder}`);
          for (const lesson of unit.lessons) {
            const savedLesson = await tx.lesson.upsert({
              where: { unitId_sortOrder: { unitId: savedUnit.id, sortOrder: lesson.sortOrder } },
              update: {}, create: { unitId: savedUnit.id, title: lesson.title, sortOrder: lesson.sortOrder }, select: { id: true, title: true },
            });
            checkMatching(savedLesson.title, lesson.title, `${unit.title} / الدرس ${lesson.sortOrder}`);
          }
        }
      }
    }
    return summary;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 });
}

export function parseSeedArgs(args: string[]) {
  if (args.some((arg) => arg !== "--apply" && arg !== "--dry-run")
    || args.length !== new Set(args).size || (args.includes("--apply") && args.includes("--dry-run"))) {
    throw new ScienceCurriculumSeedError("خيارات غير صالحة. استخدمي --dry-run للمعاينة أو --apply للكتابة.");
  }
  return { apply: args.includes("--apply") };
}

async function main() {
  const { apply } = parseSeedArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL;
  requireDevelopmentDatabase(databaseUrl, process.env.NODE_ENV);
  validateScienceCurriculum(scienceCurriculum);
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  try {
    const summary = await seedScienceCurriculum(client, scienceCurriculum, { apply, databaseUrl, nodeEnv: process.env.NODE_ENV });
    console.log(apply ? "اكتمل إدخال هيكل المنهج." : "معاينة فقط (Dry Run): لم تُكتب أي بيانات.");
    console.log(`السنة الدراسية: ${ACADEMIC_YEAR}`);
    console.log(JSON.stringify(summary, null, 2));
  } finally { await client.$disconnect(); }
}

// Imports by Vitest must never run the CLI or connect to the database.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("تعذر إدخال المنهج بسبب تعارض أو خطأ في قاعدة البيانات؛ أُلغيت تغييرات التشغيل. تحققي من اتصال التطوير ثم أعيدي المحاولة.");
    } else if (error instanceof ScienceCurriculumSeedError) {
      console.error(error.message);
    } else {
      console.error("تعذر تشغيل سكربت المنهج. تحققي من البيانات واتصال قاعدة التطوير.");
    }
    process.exitCode = 1;
  });
}
