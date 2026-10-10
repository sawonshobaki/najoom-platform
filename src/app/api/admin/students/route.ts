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
  createStudent,
} from "@/lib/students/student-service";

type CreateStudentBody = {
  fullName?: unknown;
  studentCode?: unknown;
  username?: unknown;
  password?: unknown;
  sectionId?: unknown;
};

function isString(
  value: unknown,
): value is string {
  return typeof value === "string";
}

function mapStudentError(
  error: StudentServiceError,
): string {
  switch (error.code) {
    case "invalid_username":
      return "اسم المستخدم غير صالح.";

    case "invalid_student_code":
      return "رقم الطالبة غير صالح.";

    case "invalid_full_name":
      return "اسم الطالبة غير صالح.";

    case "username_already_exists":
      return "اسم المستخدم مستخدم بالفعل.";

    case "student_code_already_exists":
      return "رقم الطالبة مستخدم بالفعل.";

    case "section_not_found":
      return "الشعبة المحددة غير موجودة.";

    case "section_inactive":
      return "الشعبة المحددة غير مفعلة.";

    default:
      return "تعذر إنشاء الطالبة.";
  }
}

export async function POST(
  request: NextRequest,
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

  let body: CreateStudentBody;

  try {
    body =
      (await request.json()) as CreateStudentBody;
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
    !isString(body.fullName) ||
    !isString(body.studentCode) ||
    !isString(body.username) ||
    !isString(body.password) ||
    !isString(body.sectionId)
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          "يرجى تعبئة جميع الحقول المطلوبة.",
      },
      {
        status: 400,
      },
    );
  }

  if (!body.sectionId.trim()) {
    return NextResponse.json(
      {
        success: false,
        message:
          "يجب اختيار الشعبة.",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const student =
      await createStudent({
        fullName: body.fullName,
        studentCode:
          body.studentCode,
        username: body.username,
        password: body.password,
        sectionId: body.sectionId,
      });

    return NextResponse.json(
      {
        success: true,
        student: {
          id: student.id,
          fullName:
            student.fullName,
          studentCode:
            student.studentCode,
        },
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    if (
      error instanceof
      StudentServiceError
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            mapStudentError(error),
        },
        {
          status: 400,
        },
      );
    }

    console.error(
      "Failed to create student:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "حدث خطأ غير متوقع أثناء إنشاء الطالبة.",
      },
      {
        status: 500,
      },
    );
  }
}