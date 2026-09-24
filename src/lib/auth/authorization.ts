import "server-only";

import { UserRole } from "@/generated/prisma/client";

import { getCurrentUser } from "@/lib/auth/auth-session";

/**
 * خطأ خاص بالمصادقة.
 *
 * نستخدم خطأ واضحًا داخليًا بدل إرجاع null في الأماكن
 * التي تتطلب مستخدمًا مسجل الدخول بشكل صريح.
 */
export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication required.");
    this.name = "AuthenticationRequiredError";
  }
}

/**
 * خطأ خاص بالصلاحيات.
 *
 * لا نضع داخل الرسالة تفاصيل حساسة عن المورد أو سبب الرفض.
 */
export class AuthorizationDeniedError extends Error {
  constructor() {
    super("Authorization denied.");
    this.name = "AuthorizationDeniedError";
  }
}

/**
 * يضمن وجود مستخدم مسجل الدخول.
 *
 * إذا لم توجد جلسة صالحة، يتم إيقاف التنفيذ بخطأ واضح.
 */
export async function requireAuthenticatedUser() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    throw new AuthenticationRequiredError();
  }

  return currentUser;
}

/**
 * يضمن أن المستخدم الحالي يملك واحدًا من الأدوار المسموحة.
 *
 * مثال:
 * await requireRole(UserRole.TEACHER, UserRole.ADMIN);
 */
export async function requireRole(
  ...allowedRoles: UserRole[]
) {
  const currentUser = await requireAuthenticatedUser();

  if (!allowedRoles.includes(currentUser.role)) {
    throw new AuthorizationDeniedError();
  }

  return currentUser;
}

/**
 * يضمن أن المستخدم الحالي طالب.
 */
export async function requireStudent() {
  return requireRole(UserRole.STUDENT);
}

/**
 * يضمن أن المستخدم الحالي معلمة.
 */
export async function requireTeacher() {
  return requireRole(UserRole.TEACHER);
}

/**
 * يضمن أن المستخدم الحالي مدير.
 */
export async function requireAdmin() {
  return requireRole(UserRole.ADMIN);
}

/**
 * يضمن أن المستخدم الحالي إما معلمة أو مدير.
 *
 * هذا مفيد للعمليات التعليمية والإدارية المشتركة.
 */
export async function requireTeacherOrAdmin() {
  return requireRole(
    UserRole.TEACHER,
    UserRole.ADMIN,
  );
}