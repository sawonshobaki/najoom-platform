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
  deleteStudent,
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

  try {
    const student =
      await deleteStudent(
        studentId,
      );

    return NextResponse.json({
      success: true,
      student,
    });
  } catch (error) {
    if (
      error instanceof
      StudentServiceError
    ) {
      if (error.code === "student_has_related_data") {
        return NextResponse.json(
          {
            success: false,
            message:
              "لدى الطالبة بيانات مرتبطة، ولا يمكن حذفها حاليًا.",
          },
          { status: 409 },
        );
      }

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

      return NextResponse.json(
        {
          success: false,
          message:
            "تعذر حذف الطالبة.",
        },
        {
          status: 400,
        },
      );
    }

    console.error(
      "Failed to delete student:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "حدث خطأ غير متوقع أثناء حذف الطالبة.",
      },
      {
        status: 500,
      },
    );
  }
}
