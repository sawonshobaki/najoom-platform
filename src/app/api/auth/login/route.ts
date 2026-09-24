import { NextRequest, NextResponse } from "next/server";

import { loginFromRequest } from "@/lib/auth/login-request";

/**
 * الحد الأقصى لطول اسم المستخدم القادم من الطلب.
 * هذه ليست سياسة اسم المستخدم النهائية، وإنما حماية مبكرة
 * من مدخلات ضخمة وغير منطقية.
 */
const MAX_USERNAME_LENGTH = 100;

/**
 * الحد الأقصى لطول كلمة المرور القادمة من الطلب.
 * سياسة كلمة المرور الفعلية موجودة في password.ts.
 */
const MAX_PASSWORD_LENGTH = 128;

type LoginRequestBody = {
  username?: unknown;
  password?: unknown;
};

/**
 * يحاول استخراج مفتاح شبكة موثوق قدر الإمكان.
 *
 * مهم:
 * لا نثق عشوائيًا بأي Header من العميل.
 * هذه الدالة ستظل محافظة حتى نثبت بيئة النشر النهائية
 * ومصدر عنوان العميل الحقيقي.
 */
function getTrustedNetworkKey(
  _request: NextRequest,
): string | undefined {
  /**
   * حاليًا لا نستخدم X-Forwarded-For مباشرة.
   *
   * السبب:
   * يمكن تزويره إذا لم تكن طبقة الـ proxy موثوقة ومحددة.
   *
   * بعد اختيار مزود النشر النهائي سنربط هنا
   * المصدر الموثوق لعنوان العميل.
   */
  return undefined;
}

/**
 * يتحقق من شكل الطلب قبل إرسال البيانات
 * إلى طبقة تسجيل الدخول.
 */
function parseLoginBody(
  body: LoginRequestBody,
):
  | {
      valid: true;
      username: string;
      password: string;
    }
  | {
      valid: false;
    } {
  if (
    typeof body.username !== "string" ||
    typeof body.password !== "string"
  ) {
    return {
      valid: false,
    };
  }

  if (
    body.username.length === 0 ||
    body.username.length > MAX_USERNAME_LENGTH
  ) {
    return {
      valid: false,
    };
  }

  if (
    body.password.length === 0 ||
    body.password.length > MAX_PASSWORD_LENGTH
  ) {
    return {
      valid: false,
    };
  }

  return {
    valid: true,
    username: body.username,
    password: body.password,
  };
}

export async function POST(
  request: NextRequest,
) {
  let body: LoginRequestBody;

  try {
    body = (await request.json()) as LoginRequestBody;
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "بيانات الدخول غير صحيحة.",
      },
      {
        status: 400,
      },
    );
  }

  const parsedBody = parseLoginBody(body);

  if (!parsedBody.valid) {
    return NextResponse.json(
      {
        success: false,
        message: "بيانات الدخول غير صحيحة.",
      },
      {
        status: 400,
      },
    );
  }

  const networkKey =
    getTrustedNetworkKey(request);

  const result = await loginFromRequest({
    username: parsedBody.username,
    password: parsedBody.password,
    networkKey,
  });

  if (!result.success) {
    const headers = new Headers();

    if (
      typeof result.retryAfterSeconds === "number" &&
      result.retryAfterSeconds > 0
    ) {
      headers.set(
        "Retry-After",
        String(result.retryAfterSeconds),
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: result.message,
      },
      {
        status: result.retryAfterSeconds
          ? 429
          : 401,
        headers,
      },
    );
  }

  return NextResponse.json(
    {
      success: true,
    },
    {
      status: 200,
    },
  );
}
