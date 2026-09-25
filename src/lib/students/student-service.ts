import "server-only";

import { UserRole } from "@/generated/prisma/client";

import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";

const MAX_USERNAME_LENGTH = 100;
const MAX_STUDENT_CODE_LENGTH = 30;
const MAX_FULL_NAME_LENGTH = 150;

export type StudentServiceErrorCode =
  | "invalid_username"
  | "invalid_student_code"
  | "invalid_full_name"
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
   * اتصال قاعدة البيانات مشغولًا أثناء عملية hashing المكلفة.
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
   * الفحص المبكر يعطي أخطاء أوضح للمستخدم.
   * القيود الفريدة في قاعدة البيانات تظل خط الدفاع النهائي.
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
      const user =
        await transaction.user.create({
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

      return transaction.student.create({
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
    },
  );
}

/**
 * يضيف طالبة غير مرتبطة حاليًا بشعبة إلى شعبة مفعلة.
 *
 * لا يسمح بالنقل المباشر بين الشعب.
 * إذا كانت الطالبة في شعبة أخرى، يجب إزالتها أولًا.
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
   * نعتبر العملية ناجحة بدون كتابة غير ضرورية.
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
   * القرار الحالي للمنصة:
   * لا يوجد نقل مباشر بين الشعب.
   *
   * يجب إزالة الطالبة من شعبتها الحالية أولًا،
   * ثم إضافتها إلى الشعبة الأخرى كعملية منفصلة.
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
 * لا يحذف:
 * - حساب الطالبة
 * - ملف الطالبة
 * - نتائجها
 * - واجباتها
 * - نقاطها
 * - بياناتها التعليمية
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

  /**
   * إذا لم تكن مرتبطة بشعبة أصلًا،
   * نعيد حالتها الحالية بدون تحديث غير ضروري.
   */
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
 * يغيّر حالة الطالبة وحساب المستخدم معًا.
 *
 * لا نسمح بأن تكون Student مفعلة بينما User معطل،
 * أو العكس.
 *
 * عند التعطيل نلغي كل الجلسات الحالية أيضًا.
 * هذا يمنع جلسة قديمة من العودة للعمل إذا أُعيد
 * تفعيل الحساب لاحقًا.
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
   * إذا كانت الحالتان متطابقتين أصلًا مع المطلوب،
   * لا ننفذ كتابات جديدة.
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
       * التعطيل يلغي الجلسات النشطة.
       *
       * الجلسات الملغاة لا نعيد تفعيلها لاحقًا،
       * حتى إذا أُعيد تفعيل حساب الطالبة.
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
 * واجهة واضحة لتعطيل الطالبة.
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
 * واجهة واضحة لإعادة تفعيل الطالبة.
 *
 * لا تعيد الجلسات القديمة التي تم إلغاؤها.
 * تحتاج الطالبة إلى تسجيل دخول جديد.
 */
export function activateStudent(
  studentId: string,
) {
  return setStudentActiveState(
    studentId,
    true,
  );
}
