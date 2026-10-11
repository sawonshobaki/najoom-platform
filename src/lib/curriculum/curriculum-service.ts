import "server-only";

import { requireAdmin } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";

export async function listCurriculum() {
  await requireAdmin();

  return prisma.grade.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      sortOrder: true,
      semesters: {
        orderBy: [
          { academicYear: "desc" },
          { sortOrder: "asc" },
          { id: "asc" },
        ],
        select: {
          id: true,
          name: true,
          academicYear: true,
          sortOrder: true,
          units: {
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            select: {
              id: true,
              title: true,
              sortOrder: true,
              lessons: {
                orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                select: {
                  id: true,
                  title: true,
                  sortOrder: true,
                },
              },
            },
          },
        },
      },
    },
  });
}
