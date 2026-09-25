import "server-only";

import {
  Prisma,
  UserRole,
} from "@/generated/prisma/client";

import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";

const MAX_USERNAME_LENGTH = 100;
const MAX_STUDENT_CODE_LENGTH = 30;
const MAX_FULL_NAME_LENGTH = 150;

export type StudentServiceErrorCode =
  | "invalid_username"
  | "invalid_student_code"
  | "invalid_full_name"
  | "invalid_student_list_query"
  | "username_already_exists"
  | "student_code_already_exists"
  | "section_not_found"
  | "section_inactive"
  | "student_not_found"
  | "student_inactive"
  | "student_already_in_section";

export class StudentServiceError extends Error {
  constructor(
    public readonly code: StudentServiceErrorCode,
  ) {
    super(code);
    this.name = "StudentServiceError";
  }
}

export type CreateStudentInput = {
  username: string;
  password: string;
  studentCode: string;
  fullName: string;
  sectionId?: string | null;
};

export type ListStudentsInput = {
  gradeId?: string;

  /**
   * string = شعبة محددة
   * null = طالبات غير مرتبطات بأي شعبة
   * undefined = كل الشعب
   */
  sectionId?: string | null;

  isActive?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
};

function normalizeUsername(
  username: string,
): string {
  return username.trim();
}

function normalizeStudentCode(
  studentCode: string,
): string {
  return studentCode.trim().toUpperCase();
}

function normalizeFullName(
  fullName: string,
): string {
  return fullName.trim();
}

function validateStudentIdentity(input: {
  username: string;
  studentCode: string;
  fullName: string;
}) {
  if (
    input.username.length === 0 ||
    input.username.length > MAX_USERNAME_LENGTH
  ) {
    throw new StudentServiceError(
      "invalid_username",
    );
  }

  if (
    input.studentCode.length === 0 ||
    input.studentCode.length >
      MAX_STUDENT_CODE_LENGTH
  ) {
    throw new StudentServiceError(
      "invalid_student_code",
    );
  }

  if (
    input.fullName.length === 0 ||
    input.fullName.length > MAX_FULL_NAME_LENGTH
  ) {
    throw new StudentServiceError(
      "invalid_full_name",
    );
  }
}

/**
 * يفحص أخطاء Prisma بدون الاعتماد على الشكل الداخلي
 * الكامل للخطأ.
 *
 * نستخدمه لمعالجة تعارضات UNIQUE التي قد تظهر
 * عند وصول طلبين متزامنين.
 */
function isPrismaErrorWithCode(
  error: unknown,
  code: string,
): boolean {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error)
  ) {
    return false;
  }

  return error.code === code;
}

/**
 * يتحقق من أن الشعبة موجودة ومفعلة.
 *
 * لا نسمح بإضافة طالبة إلى شعبة معطلة.
 */
async function requireActiveSection(
  sectionId: string,
) {
  const section = await prisma.section.findUnique({
    where: {
      id: sectionId,
    },
    select: {
      id: true,
      isActive: true,
    },
  });

  if (!section) {
    throw new StudentServiceError(
      "section_not_found",
    );
  }

  if (!section.isActive) {
    throw new StudentServiceError(
      "section_inactive",
    );
  }

  return section;
}

/**
 * ينشئ حساب الطالبة وملفها الدراسي داخل transaction واحدة.
 *
 * إذا فشل إنشاء أي جزء، لا يبقى حساب ناقص في قاعدة البيانات.
 */
export async function createStudent(
  input: CreateStudentInput,
) {
  const username = normalizeUsername(
    input.username,
  );

  const studentCode = normalizeStudentCode(
    input.studentCode,
  );

  const fullName = normalizeFullName(
    input.fullName,
  );

  validateStudentIdentity({
    username,
    studentCode,
    fullName,
  });

  /**
   * ننفذ Argon2 قبل فتح transaction حتى لا نبقي
   * اتصال قاعدة البيانات مشغولًا أثناء hashing.
   */
  const passwordHash = await hashPassword(
    input.password,
  );

  const sectionId =
    input.sectionId?.trim() || null;

  if (sectionId) {
    await requireActiveSection(sectionId);
  }

  /**
   * الفحص المبكر يعطي أخطاء أوضح في الحالة العادية.
   *
   * لكنه لا يكفي وحده لمنع race condition، لذلك تبقى
   * قيود UNIQUE في قاعدة البيانات خط الدفاع النهائي.
   */
  const [existingUser, existingStudent] =
    await Promise.all([
      prisma.user.findUnique({
        where: {
          username,
        },
        select: {
          id: true,
        },
      }),

      prisma.student.findUnique({
        where: {
          studentCode,
        },
        select: {
          id: true,
        },
      }),
    ]);

  if (existingUser) {
    throw new StudentServiceError(
      "username_already_exists",
    );
  }

  if (existingStudent) {
    throw new StudentServiceError(
      "student_code_already_exists",
    );
  }

  return prisma.$transaction(
    async (transaction) => {
      let user: {
        id: string;
        username: string;
      };

      try {
        user = await transaction.user.create({
          data: {
            username,
            passwordHash,
            role: UserRole.STUDENT,
            isActive: true,
          },
          select: {
            id: true,
            username: true,
          },
        });
      } catch (error) {
        /**
         * قد ينجح الفحص المبكر في طلبين متزامنين.
         *
         * إذا سبق طلب آخر هذا الطلب وأنشأ username نفسه،
         * يحول P2002 إلى خطأ خدمة واضح بدل تسريب خطأ Prisma.
         */
        if (
          isPrismaErrorWithCode(
            error,
            "P2002",
          )
        ) {
          throw new StudentServiceError(
            "username_already_exists",
          );
        }

        throw error;
      }

      try {
        return await transaction.student.create({
          data: {
            userId: user.id,
            studentCode,
            fullName,
            currentSectionId: sectionId,
            isActive: true,
          },
          select: {
            id: true,
            studentCode: true,
            fullName: true,
            currentSectionId: true,
            isActive: true,
            user: {
              select: {
                id: true,
                username: true,
                role: true,
                isActive: true,
              },
            },
          },
        });
      } catch (error) {
        /**
         * نفس الحماية السابقة، ولكن لقيد studentCode.
         *
         * transaction ستتراجع بالكامل عند الخطأ،
         * وبالتالي لن يبقى User بدون Student.
         */
        if (
          isPrismaErrorWithCode(
            error,
            "P2002",
          )
        ) {
          throw new StudentServiceError(
            "student_code_already_exists",
          );
        }

        throw error;
      }
    },
  );
}

/**
 * يضيف طالبة غير مرتبطة حاليًا بشعبة إلى شعبة مفعلة.
 *
 * لا يسمح بالنقل المباشر بين الشعب.
 * يجب إزالة الطالبة من شعبتها الحالية أولًا.
 */
export async function addStudentToSection(
  studentId: string,
  sectionId: string,
) {
  const normalizedSectionId =
    sectionId.trim();

  if (!normalizedSectionId) {
    throw new StudentServiceError(
      "section_not_found",
    );
  }

  await requireActiveSection(
    normalizedSectionId,
  );

  const student =
    await prisma.student.findUnique({
      where: {
        id: studentId,
      },
      select: {
        id: true,
        isActive: true,
        currentSectionId: true,
      },
    });

  if (!student) {
    throw new StudentServiceError(
      "student_not_found",
    );
  }

  if (!student.isActive) {
    throw new StudentServiceError(
      "student_inactive",
    );
  }

  /**
   * إذا كانت في نفس الشعبة بالفعل،
   * لا ننفذ تحديثًا غير ضروري.
   */
  if (
    student.currentSectionId ===
    normalizedSectionId
  ) {
    return prisma.student.findUniqueOrThrow({
      where: {
        id: student.id,
      },
      select: {
        id: true,
        studentCode: true,
        fullName: true,
        currentSectionId: true,
        isActive: true,
      },
    });
  }

  /**
   * لا يوجد نقل مباشر بين الشعب.
   */
  if (student.currentSectionId) {
    throw new StudentServiceError(
      "student_already_in_section",
    );
  }

  return prisma.student.update({
    where: {
      id: student.id,
    },
    data: {
      currentSectionId:
        normalizedSectionId,
    },
    select: {
      id: true,
      studentCode: true,
      fullName: true,
      currentSectionId: true,
      isActive: true,
    },
  });
}

/**
 * يزيل الطالبة من شعبتها الحالية فقط.
 *
 * لا يحذف الحساب أو الملف الدراسي أو النتائج.
 */
export async function removeStudentFromSection(
  studentId: string,
) {
  const student =
    await prisma.student.findUnique({
      where: {
        id: studentId,
      },
      select: {
        id: true,
        currentSectionId: true,
      },
    });

  if (!student) {
    throw new StudentServiceError(
      "student_not_found",
    );
  }

  if (!student.currentSectionId) {
    return prisma.student.findUniqueOrThrow({
      where: {
        id: student.id,
      },
      select: {
        id: true,
        studentCode: true,
        fullName: true,
        currentSectionId: true,
        isActive: true,
      },
    });
  }

  return prisma.student.update({
    where: {
      id: student.id,
    },
    data: {
      currentSectionId: null,
    },
    select: {
      id: true,
      studentCode: true,
      fullName: true,
      currentSectionId: true,
      isActive: true,
    },
  });
}

/**
 * يغيّر حالة Student وUser معًا.
 *
 * عند تعطيل الحساب تلغى الجلسات النشطة أيضًا.
 */
export async function setStudentActiveState(
  studentId: string,
  isActive: boolean,
) {
  const student =
    await prisma.student.findUnique({
      where: {
        id: studentId,
      },
      select: {
        id: true,
        userId: true,
        isActive: true,
        user: {
          select: {
            isActive: true,
          },
        },
      },
    });

  if (!student) {
    throw new StudentServiceError(
      "student_not_found",
    );
  }

  /**
   * لا نكتب إلى قاعدة البيانات إذا كانت
   * الحالتان مطابقتين أصلًا للقيمة المطلوبة.
   */
  if (
    student.isActive === isActive &&
    student.user.isActive === isActive
  ) {
    return prisma.student.findUniqueOrThrow({
      where: {
        id: student.id,
      },
      select: {
        id: true,
        studentCode: true,
        fullName: true,
        currentSectionId: true,
        isActive: true,
        user: {
          select: {
            id: true,
            username: true,
            role: true,
            isActive: true,
          },
        },
      },
    });
  }

  const now = new Date();

  return prisma.$transaction(
    async (transaction) => {
      await transaction.user.update({
        where: {
          id: student.userId,
        },
        data: {
          isActive,
        },
      });

      const updatedStudent =
        await transaction.student.update({
          where: {
            id: student.id,
          },
          data: {
            isActive,
          },
          select: {
            id: true,
            studentCode: true,
            fullName: true,
            currentSectionId: true,
            isActive: true,
            user: {
              select: {
                id: true,
                username: true,
                role: true,
                isActive: true,
              },
            },
          },
        });

      /**
       * الجلسات القديمة لا تعاد عند إعادة تفعيل الحساب.
       */
      if (!isActive) {
        await transaction.session.updateMany({
          where: {
            userId: student.userId,
            revokedAt: null,
          },
          data: {
            revokedAt: now,
            revokeReason:
              "student_deactivated",
          },
        });
      }

      return updatedStudent;
    },
  );
}

/**
 * يعطل الطالبة وحسابها.
 */
export function deactivateStudent(
  studentId: string,
) {
  return setStudentActiveState(
    studentId,
    false,
  );
}

/**
 * يعيد تفعيل الطالبة.
 *
 * الجلسات القديمة الملغاة لا تعاد.
 */
export function activateStudent(
  studentId: string,
) {
  return setStudentActiveState(
    studentId,
    true,
  );
}

/**
 * يجلب الطالبات لقائمة الإدارة مع الفلاتر
 * والترقيم بالصفحات.
 */
export async function listStudents(
  input: ListStudentsInput = {},
) {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 25;

  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100
  ) {
    throw new StudentServiceError(
      "invalid_student_list_query",
    );
  }

  const gradeId = input.gradeId?.trim();
  const search = input.search?.trim();

  if (
    gradeId !== undefined &&
    gradeId.length === 0
  ) {
    throw new StudentServiceError(
      "invalid_student_list_query",
    );
  }

  if (
    typeof input.sectionId === "string" &&
    input.sectionId.trim().length === 0
  ) {
    throw new StudentServiceError(
      "invalid_student_list_query",
    );
  }

  if (search && search.length > 100) {
    throw new StudentServiceError(
      "invalid_student_list_query",
    );
  }

  const sectionId =
    typeof input.sectionId === "string"
      ? input.sectionId.trim()
      : input.sectionId;

  const where: Prisma.StudentWhereInput = {};

  if (input.isActive !== undefined) {
    where.isActive = input.isActive;
  }

  /**
   * null تعني الطالبات غير المرتبطات بأي شعبة.
   */
  if (sectionId === null) {
    where.currentSectionId = null;
  } else if (sectionId) {
    where.currentSectionId = sectionId;
  }

  /**
   * الصف مشتق من الشعبة الحالية.
   *
   * الطالبة غير المرتبطة بشعبة لا تظهر
   * داخل فلتر صف محدد.
   */
  if (gradeId) {
    where.currentSection = {
      is: {
        gradeId,
      },
    };
  }

  if (search) {
    where.OR = [
      {
        fullName: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        studentCode: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        user: {
          username: {
            contains: search,
            mode: "insensitive",
          },
        },
      },
    ];
  }

  const skip = (page - 1) * pageSize;

  const [students, totalCount] =
    await Promise.all([
      prisma.student.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [
          {
            fullName: "asc",
          },
          {
            studentCode: "asc",
          },
        ],
        select: {
          id: true,
          studentCode: true,
          fullName: true,
          isActive: true,
          currentSectionId: true,
          user: {
            select: {
              id: true,
              username: true,
              isActive: true,
            },
          },
          currentSection: {
            select: {
              id: true,
              name: true,
              isActive: true,
              grade: {
                select: {
                  id: true,
                  name: true,
                  sortOrder: true,
                },
              },
            },
          },
        },
      }),

      prisma.student.count({
        where,
      }),
    ]);

  return {
    students,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages:
        totalCount === 0
          ? 0
          : Math.ceil(
              totalCount / pageSize,
            ),
    },
  };
}
