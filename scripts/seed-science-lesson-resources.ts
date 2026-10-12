import "dotenv/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { requireDevelopmentDatabase, parseSeedArgs } from "./seed-science-curriculum";
import { RESOURCE_ACADEMIC_YEAR, scienceLessonResources, type ScienceLessonResource } from "./science-lesson-resources-data";

export class ScienceResourcesSeedError extends Error {}
const resourceFields = ["title", "url", "type", "language", "isFree", "sortOrder", "instructionsArabic"] as const;
const lessonKey = (item: ScienceLessonResource) => JSON.stringify([item.grade, item.semester, item.unit, item.lesson]);

export function validateScienceLessonResources(data: ScienceLessonResource[]) {
  if (data.length !== 10) throw new ScienceResourcesSeedError("يجب أن تحتوي الدفعة على 10 موارد فقط.");
  const urls = new Set<string>();
  const orders = new Set<string>();
  const distribution = new Map<string, number>();
  for (const item of data) {
    if (!["الصف الخامس", "الصف السادس"].includes(item.grade) || !["الفصل الدراسي الأول", "الفصل الدراسي الثاني"].includes(item.semester)
      || [item.unit, item.lesson, item.title, item.language, item.instructionsArabic].some(value => typeof value !== "string" || !value.trim())
      || !["VIDEO", "GAME", "SIMULATION", "ARTICLE"].includes(item.type)
      || typeof item.isFree !== "boolean" || !Number.isInteger(item.sortOrder) || item.sortOrder < 1 || item.sortOrder > 2147483647) {
      throw new ScienceResourcesSeedError("بيانات المورد أو مسار الدرس غير صالحة.");
    }
    let url: URL;
    try { url = new URL(item.url); }
    catch { throw new ScienceResourcesSeedError("رابط المورد غير صالح."); }
    if (url.protocol !== "https:" || !item.url.startsWith("https://") || url.username || url.password
      || url.port || !["phet.colorado.edu", "spaceplace.nasa.gov", "education.nationalgeographic.org", "studywithstem.github.io"].includes(item.sourceHost) || url.hostname !== item.sourceHost) {
      throw new ScienceResourcesSeedError(`يجب أن يكون رابط «${item.title}» HTTPS وعلى مضيف المصدر المعتمد.`);
    }
    const key = lessonKey(item);
    const urlKey = JSON.stringify([key, item.url]);
    const orderKey = JSON.stringify([key, item.sortOrder]);
    if (urls.has(urlKey) || orders.has(orderKey)) throw new ScienceResourcesSeedError("رابط أو ترتيب مورد مكرر داخل الدرس نفسه.");
    urls.add(urlKey); orders.add(orderKey);
    distribution.set(key, (distribution.get(key) ?? 0) + 1);
  }
  if (distribution.size !== 9 || [...distribution.values()].sort().join() !== "1,1,1,1,1,1,1,1,2") {
    throw new ScienceResourcesSeedError("يجب توزيع الموارد العشرة على تسعة دروس: ثمانية دروس بمورد واحد ودرس بموردين.");
  }
  return { resources: data.length, lessons: distribution.size };
}

async function inspectResources(tx: Prisma.TransactionClient, data: ScienceLessonResource[]) {
  const plans = [];
  for (const item of data) {
    // Titles are not unique in the schema: reject ambiguity instead of selecting an arbitrary row.
    const lessons = await tx.lesson.findMany({
      where: { title: item.lesson, unit: { title: item.unit, semester: {
        name: item.semester, academicYear: RESOURCE_ACADEMIC_YEAR, grade: { name: item.grade },
      } } }, select: { id: true }, take: 2,
    });
    const path = `${item.grade} / ${item.semester} / ${item.unit} / ${item.lesson}`;
    if (lessons.length !== 1) throw new ScienceResourcesSeedError(`${lessons.length ? "مسار درس ملتبس" : "الدرس غير موجود"}: ${path}.`);
    const lessonId = lessons[0].id;
    const rows = await tx.lessonResource.findMany({ where: { lessonId, OR: [{ url: item.url }, { sortOrder: item.sortOrder }] } });
    const matching = rows.filter(row => row.url === item.url);
    if (matching.length > 1 || rows.some(row => row.url !== item.url && row.sortOrder === item.sortOrder)
      || matching.some(row => resourceFields.some(field => row[field] !== item[field]))) {
      throw new ScienceResourcesSeedError(`تعارض في المورد «${item.title}» داخل ${path}: رابط مكرر أو بيانات مختلفة أو ترتيب مشغول. لم يُستبدل أي مورد.`);
    }
    plans.push({ item, lessonId, path, matched: matching.length === 1 });
  }
  return plans;
}

export async function seedScienceLessonResources(client: PrismaClient, data: ScienceLessonResource[], options: {
  apply: boolean; databaseUrl: string | undefined; nodeEnv?: string;
}) {
  requireDevelopmentDatabase(options.databaseUrl, options.nodeEnv);
  const totals = validateScienceLessonResources(data);
  return client.$transaction(async tx => {
    if (options.apply) {
      // No unique URL constraint exists. Serialize inserts, including ordinary admin writes,
      // during the short validation/write transaction; never change schema or existing rows.
      await tx.$executeRaw`LOCK TABLE "lesson_resources" IN SHARE ROW EXCLUSIVE MODE`;
    } else {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    }
    const plans = await inspectResources(tx, data);
    if (options.apply) {
      for (const plan of plans) {
        if (!plan.matched) {
          const fields = plan.item;
          // Explicit fields ensure only LessonResource data is ever written.
          await tx.lessonResource.create({ data: {
            lessonId: plan.lessonId, title: fields.title, url: fields.url, type: fields.type,
            language: fields.language, isFree: fields.isFree, sortOrder: fields.sortOrder,
            instructionsArabic: fields.instructionsArabic,
          } });
        }
      }
    }
    return {
      totals, create: plans.filter(plan => !plan.matched).length, matched: plans.filter(plan => plan.matched).length,
      lessons: [...new Set(plans.map(plan => plan.path))].map(path => ({
        path, resources: plans.filter(plan => plan.path === path).length,
      })),
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 });
}

async function main() {
  const { apply } = parseSeedArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL;
  requireDevelopmentDatabase(databaseUrl, process.env.NODE_ENV);
  validateScienceLessonResources(scienceLessonResources);
  const url = new URL(databaseUrl!);
  console.log(`قاعدة التطوير: ${url.pathname.slice(1)} — المضيف: ${url.hostname} — السنة: ${RESOURCE_ACADEMIC_YEAR}`);
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  try {
    const summary = await seedScienceLessonResources(client, scienceLessonResources, { apply, databaseUrl, nodeEnv: process.env.NODE_ENV });
    console.log(apply ? "اكتمل إدخال الموارد." : "معاينة فقط (Dry Run): لم تُكتب أي بيانات.");
    console.log(JSON.stringify(summary, null, 2));
  } finally { await client.$disconnect(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    // Do not print connection strings or internal database details.
    console.error(error instanceof ScienceResourcesSeedError ? error.message
      : "تعذر تشغيل سكربت الموارد؛ تحققي من قاعدة التطوير والبيانات والخيارات. أُلغيت أي كتابة في المعاملة.");
    process.exitCode = 1;
  });
}
