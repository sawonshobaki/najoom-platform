import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  AuthenticationRequiredError,
  AuthorizationDeniedError,
  requireAdmin,
} from "@/lib/auth/authorization";

import {
  StudentServiceError,
  setStudentActiveState,
} from "@/lib/students/student-service";

type RouteContext = {
  params: Promise<{
    studentId: string;
  }>;
};

type UpdateActiveBody = {
  isActive?: unknown;
};

export async function PATCH(
  request: NextRequest,
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

  if (!studentId.trim()) {
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

  let body: UpdateActiveBody;

  try {
    const parsedBody: unknown = await request.json();

    if (
      parsedBody === null ||
      typeof parsedBody !== "object" ||
      Array.isArray(parsedBody)
    ) {
      throw new Error("Invalid request body.");
    }

    body = parsedBody as UpdateActiveBody;
  } catch {
    return NextResponse.json(
      {
        success: false,
        message:
          "بيانات الطلب غير صالحة.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    typeof body.isActive !==
    "boolean"
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          "حالة الحساب غير صالحة.",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const student =
      await setStudentActiveState(
        studentId,
        body.isActive,
      );

    return NextResponse.json({
      success: true,
      student: {
        id: student.id,
        isActive:
          student.isActive,
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

      return NextResponse.json(
        {
          success: false,
          message:
            "تعذر تحديث حالة الطالبة.",
        },
        {
          status: 400,
        },
      );
    }

    console.error(
      "Failed to update student active state:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "حدث خطأ غير متوقع أثناء تحديث الحساب.",
      },
      {
        status: 500,
      },
    );
  }
}
