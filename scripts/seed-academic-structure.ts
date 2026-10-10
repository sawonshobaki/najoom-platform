import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import {
  PrismaClient,
} from "../src/generated/prisma/client";

type GradeSeed = {
  name: string;
  sortOrder: number;
  sections: string[];
};

const grades: GradeSeed[] = [
  {
    name: "الصف الخامس",
    sortOrder: 5,
    sections: ["أ", "ب"],
  },
  {
    name: "الصف السادس",
    sortOrder: 6,
    sections: ["أ", "ب"],
  },
];

function requireEnvironmentVariable(
  name: string,
): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `${name} is required.`,
    );
  }

  return value;
}

const databaseUrl =
  requireEnvironmentVariable(
    "DATABASE_URL",
  );

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});

const prisma = new PrismaClient({
  adapter,
});

async function ensureGrade(
  gradeSeed: GradeSeed,
) {
  const grade =
    await prisma.grade.upsert({
      where: {
        name: gradeSeed.name,
      },
      update: {
        sortOrder:
          gradeSeed.sortOrder,
      },
      create: {
        name: gradeSeed.name,
        sortOrder:
          gradeSeed.sortOrder,
      },
      select: {
        id: true,
        name: true,
        sortOrder: true,
      },
    });

  console.log(
    `✓ Grade ready: ${grade.name}`,
  );

  for (
    const sectionName
    of gradeSeed.sections
  ) {
    const existingSection =
      await prisma.section.findFirst({
        where: {
          gradeId: grade.id,
          name: sectionName,
        },
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      });

    if (existingSection) {
      if (!existingSection.isActive) {
        await prisma.section.update({
          where: {
            id: existingSection.id,
          },
          data: {
            isActive: true,
          },
        });
      }

      console.log(
        `  ✓ Section ready: ${sectionName}`,
      );

      continue;
    }

    await prisma.section.create({
      data: {
        gradeId: grade.id,
        name: sectionName,
        isActive: true,
      },
    });

    console.log(
      `  ✓ Section created: ${sectionName}`,
    );
  }
}

async function main() {
  console.log("");
  console.log(
    "Preparing Najoom academic structure...",
  );
  console.log("");

  for (const grade of grades) {
    await ensureGrade(grade);
  }

  console.log("");
  console.log(
    "Academic structure is ready.",
  );
}

main()
  .catch((error: unknown) => {
    console.error("");
    console.error(
      "Failed to seed academic structure:",
    );

    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });