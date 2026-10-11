import "server-only";

import {
  Prisma,
  UserRole,
} from "@/generated/prisma/client";

import {
  hashPassword,
  validatePasswordPolicy,
} from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";

const MAX_USERNAME_LENGTH = 100;
const MAX_STUDENT_CODE_LENGTH = 30;
const MAX_FULL_NAME_LENGTH = 150;

export type StudentServiceErrorCode =
  | "invalid_username"
  | "invalid_student_code"
  | "invalid_full_name"
  | "invalid_password"
  | "invalid_student_list_query"
  | "username_already_exists"
  | "student_code_already_exists"
  | "section_not_found"
  | "section_inactive"
  | "student_not_found"
  | "student_inactive"
  | "student_already_in_section"
  | "student_section_changed"
  | "student_has_related_data";

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
  sectionId?: string | null;
  isActive?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
};

const studentSectionSelect = {
  id: true,
  studentCode: true,
  fullName: true,
  currentSectionId: true,
  isActive: true,
} as const;

const studentWithUserSelect = {
  ...studentSectionSelect,
  user: {
    select: {
      id: true,
      username: true,
      role: true,
      isActive: true,
    },
  },
} as const;

function normalizeUsername(value: string): string {
  return value.trim();
}

function normalizeStudentCode(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeFullName(value: string): string {
  return value.trim();
}

function validateStudentIdentity(input: {
  username: string;
  studentCode: string;
  fullName: string;
}): void {
  if (
    input.username.length === 0 ||
    input.username.length > MAX_USERNAME_LENGTH
  ) {
    throw new StudentServiceError("invalid_username");
  }

  if (
    input.studentCode.length === 0 ||
    input.studentCode.length > MAX_STUDENT_CODE_LENGTH
  ) {
    throw new StudentServiceError("invalid_student_code");
  }

  if (
    input.fullName.length === 0 ||
    input.fullName.length > MAX_FULL_NAME_LENGTH
  ) {
    throw new StudentServiceError("invalid_full_name");
  }
}

function isPrismaErrorWithCode(
  error: unknown,
  code: string,
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

async function requireActiveSection(sectionId: string) {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    select: {
      id: true,
      isActive: true,
    },
  });

  if (!section) {
    throw new StudentServiceError("section_not_found");
  }

  if (!section.isActive) {
    throw new StudentServiceError("section_inactive");
  }

  return section;
}

/**
 * إنشاء حساب الطالبة وملفها الدراسي في معاملة واحدة.
 */
export async function createStudent(
  input: CreateStudentInput,
) {
  const username = normalizeUsername(input.username);
  const studentCode = normalizeStudentCode(
    input.studentCode,
  );
  const fullName = normalizeFullName(input.fullName);

  validateStudentIdentity({
    username,
    studentCode,
    fullName,
  });

  if (!validatePasswordPolicy(input.password).valid) {
    throw new StudentServiceError("invalid_password");
  }

  // ننفذ التشفير قبل فتح معاملة قاعدة البيانات.
  const passwordHash = await hashPassword(
    input.password,
  );

  const sectionId = input.sectionId?.trim() || null;

  if (sectionId) {
    await requireActiveSection(sectionId);
  }

  // فحص مبكر للحصول على رسائل أخطاء واضحة.
  const [existingUser, existingStudent] =
    await Promise.all([
      prisma.user.findUnique({
        where: { username },
        select: { id: true },
      }),
      prisma.student.findUnique({
        where: { studentCode },
        select: { id: true },
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

  // قيود UNIQUE تعالج أيضًا الطلبات المتزامنة.
  return prisma.$transaction(async (transaction) => {
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
      if (isPrismaErrorWithCode(error, "P2002")) {
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
        select: studentWithUserSelect,
      });
    } catch (error) {
      if (isPrismaErrorWithCode(error, "P2002")) {
        throw new StudentServiceError(
          "student_code_already_exists",
        );
      }

      throw error;
    }
  });
}

/**
 * إضافة طالبة غير مرتبطة بشعبة إلى شعبة نشطة.
 * النقل المباشر بين الشعب ممنوع.
 */
export async function addStudentToSection(
  studentId: string,
  sectionId: string,
) {
  const normalizedSectionId = sectionId.trim();

  if (!normalizedSectionId) {
    throw new StudentServiceError(
      "section_not_found",
    );
  }

  await requireActiveSection(normalizedSectionId);

  const student = await prisma.student.findUnique({
    where: { id: studentId },
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

  // إذا كانت الطالبة في الشعبة المطلوبة بالفعل.
  if (
    student.currentSectionId === normalizedSectionId
  ) {
    return prisma.student.findUniqueOrThrow({
      where: { id: student.id },
      select: studentSectionSelect,
    });
  }

  // لا نسمح بالنقل المباشر بين الشعب.
  if (student.currentSectionId !== null) {
    throw new StudentServiceError(
      "student_already_in_section",
    );
  }

  // تحديث مشروط يمنع تعيين الطالبة إلى شعبتين.
  const assignment = await prisma.student.updateMany({
    where: {
      id: student.id,
      isActive: true,
      currentSectionId: null,
    },
    data: {
      currentSectionId: normalizedSectionId,
    },
  });

  if (assignment.count === 1) {
    return prisma.student.findUniqueOrThrow({
      where: { id: student.id },
      select: studentSectionSelect,
    });
  }

  // نعيد القراءة لمعرفة سبب فشل التحديث المشروط.
  const currentStudent =
    await prisma.student.findUnique({
      where: { id: student.id },
      select: {
        id: true,
        isActive: true,
        currentSectionId: true,
      },
    });

  if (!currentStudent) {
    throw new StudentServiceError(
      "student_not_found",
    );
  }

  if (!currentStudent.isActive) {
    throw new StudentServiceError(
      "student_inactive",
    );
  }

  // طلب متزامن أضافها إلى الشعبة نفسها.
  if (
    currentStudent.currentSectionId ===
    normalizedSectionId
  ) {
    return prisma.student.findUniqueOrThrow({
      where: { id: currentStudent.id },
      select: studentSectionSelect,
    });
  }

  // طلب آخر أضافها إلى شعبة مختلفة.
  if (currentStudent.currentSectionId !== null) {
    throw new StudentServiceError(
      "student_already_in_section",
    );
  }

  throw new Error(
    "Student section assignment failed unexpectedly.",
  );
}

/**
 * إزالة الطالبة من شعبتها دون حذف حسابها أو نتائجها.
 *
 * لا يُسمح لطلب إزالة قديم بمسح تعيين جديد
 * إلى شعبة مختلفة.
 */
export async function removeStudentFromSection(
  studentId: string,
) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
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

  // الطالبة غير مرتبطة بأي شعبة بالفعل.
  if (student.currentSectionId === null) {
    return prisma.student.findUniqueOrThrow({
      where: { id: student.id },
      select: studentSectionSelect,
    });
  }

  const originalSectionId =
    student.currentSectionId;

  // لا نحذف التعيين إلا إذا بقيت الشعبة كما كانت.
  const removal = await prisma.student.updateMany({
    where: {
      id: student.id,
      currentSectionId: originalSectionId,
    },
    data: {
      currentSectionId: null,
    },
  });

  if (removal.count === 1) {
    return prisma.student.findUniqueOrThrow({
      where: { id: student.id },
      select: studentSectionSelect,
    });
  }

  // فشل الشرط؛ نتحقق مما حدث.
  const currentStudent =
    await prisma.student.findUnique({
      where: { id: student.id },
      select: {
        id: true,
        currentSectionId: true,
      },
    });

  if (!currentStudent) {
    throw new StudentServiceError(
      "student_not_found",
    );
  }

  // طلب آخر أزالها بالفعل.
  if (currentStudent.currentSectionId === null) {
    return prisma.student.findUniqueOrThrow({
      where: { id: currentStudent.id },
      select: studentSectionSelect,
    });
  }

  // تغيرت الشعبة؛ نحافظ على التعيين الجديد.
  if (
    currentStudent.currentSectionId !==
    originalSectionId
  ) {
    throw new StudentServiceError(
      "student_section_changed",
    );
  }

  // فشل غير متوقع؛ لا نبلّغ عن نجاح وهمي.
  throw new Error(
    "Student section removal failed unexpectedly.",
  );
}

/**
 * تفعيل حساب الطالبة أو تعطيله.
 * تُحدّث حالة User وStudent داخل معاملة واحدة.
 */
export async function setStudentActiveState(
  studentId: string,
  isActive: boolean,
) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
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

  // لا نفتح معاملة إذا كانت الحالتان صحيحتين.
  if (
    student.isActive === isActive &&
    student.user.isActive === isActive
  ) {
    return prisma.student.findUniqueOrThrow({
      where: { id: student.id },
      select: studentWithUserSelect,
    });
  }

  const now = new Date();

  return prisma.$transaction(async (transaction) => {
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
        select: studentWithUserSelect,
      });

    // عند التعطيل نلغي الجلسات النشطة.
    if (!isActive) {
      await transaction.session.updateMany({
        where: {
          userId: student.userId,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
          revokeReason: "student_deactivated",
        },
      });
    }

    return updatedStudent;
  });
}

export function deactivateStudent(
  studentId: string,
) {
  return setStudentActiveState(studentId, false);
}

export function activateStudent(
  studentId: string,
) {
  return setStudentActiveState(studentId, true);
}

/**
 * عرض الطالبات للإدارة مع البحث والتصفية
 * وتقسيم النتائج إلى صفحات.
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

  // null يعني الطالبات غير المرتبطات بشعبة.
  if (sectionId === null) {
    where.currentSectionId = null;
  } else if (sectionId) {
    where.currentSectionId = sectionId;
  }

  // الصف الدراسي مشتق من الشعبة الحالية.
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
          { fullName: "asc" },
          { studentCode: "asc" },
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
          : Math.ceil(totalCount / pageSize),
    },
  };
}
export async function listActiveGradesAndSections() {
  return prisma.grade.findMany({
    orderBy: {
      sortOrder: "asc",
    },
    select: {
      id: true,
      name: true,
      sortOrder: true,
      sections: {
        where: {
          isActive: true,
        },
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}
export async function deleteStudent(
  studentId: string,
) {
  const normalizedStudentId =
    studentId.trim();

  if (!normalizedStudentId) {
    throw new StudentServiceError(
      "student_not_found",
    );
  }

  const student =
    await prisma.student.findUnique({
      where: {
        id: normalizedStudentId,
      },

      select: {
        id: true,
        userId: true,
        studentCode: true,
        fullName: true,
      },
    });

  if (!student) {
    throw new StudentServiceError(
      "student_not_found",
    );
  }

  try {
    await prisma.user.delete({
      where: {
        id: student.userId,
      },
    });
  } catch (error) {
    if (isPrismaErrorWithCode(error, "P2003")) {
      throw new StudentServiceError(
        "student_has_related_data",
      );
    }

    throw error;
  }

  return {
    id: student.id,
    studentCode:
      student.studentCode,
    fullName:
      student.fullName,
  };
}
