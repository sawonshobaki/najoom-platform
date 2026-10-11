import {
  NextResponse,
} from "next/server";

import {
  AuthenticationRequiredError,
  AuthorizationDeniedError,
  requireAdmin,
} from "@/lib/auth/authorization";

import {
  StudentServiceError,
  removeStudentFromSection,
} from "@/lib/students/student-service";

type RouteContext = {
  params: Promise<{
    studentId: string;
  }>;
};

export async function DELETE(
  _request: Request,
  context: RouteContext,
) {
  try {
    await requireAdmin();
  } catch (error) {
    if (
      error instanceof
      AuthenticationRequiredError
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "يجب تسجيل الدخول أولًا.",
        },
        {
          status: 401,
        },
      );
    }

    if (
      error instanceof
      AuthorizationDeniedError
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ليس لديك صلاحية لتنفيذ هذه العملية.",
        },
        {
          status: 403,
        },
      );
    }

    throw error;
  }

  const { studentId } =
    await context.params;

  const normalizedStudentId =
    studentId.trim();

  if (!normalizedStudentId) {
    return NextResponse.json(
      {
        success: false,
        message:
          "معرف الطالبة غير صالح.",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const student =
      await removeStudentFromSection(
        normalizedStudentId,
      );

    return NextResponse.json({
      success: true,
      student: {
        id: student.id,
        currentSectionId:
          student.currentSectionId,
      },
    });
  } catch (error) {
    if (
      error instanceof
      StudentServiceError
    ) {
      if (
        error.code ===
        "student_not_found"
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "الطالبة غير موجودة.",
          },
          {
            status: 404,
          },
        );
      }

      if (
        error.code ===
        "student_section_changed"
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "تغيرت شعبة الطالبة أثناء العملية. حدّثي الصفحة وحاولي مرة أخرى.",
          },
          {
            status: 409,
          },
        );
      }

      return NextResponse.json(
        {
          success: false,
          message:
            "تعذر إزالة الطالبة من الشعبة.",
        },
        {
          status: 400,
        },
      );
    }

    console.error(
      "Failed to remove student from section:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "حدث خطأ غير متوقع أثناء إزالة الطالبة من الشعبة.",
      },
      {
        status: 500,
      },
    );
  }
}