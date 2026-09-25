import "server-only";

import { UserRole } from "@/generated/prisma/client";

/**
 * المسارات الرئيسية لكل دور.
 *
 * إبقاء هذا الربط في مكان واحد يمنع تكرار منطق التوجيه
 * داخل الصفحات وواجهات تسجيل الدخول.
 */
const ROLE_HOME_PATHS: Record<UserRole, string> = {
  STUDENT: "/student",
  TEACHER: "/teacher",
  ADMIN: "/admin",
};

/**
 * يعيد الصفحة الرئيسية المناسبة للدور.
 */
export function getRoleHomePath(role: UserRole): string {
  return ROLE_HOME_PATHS[role];
}
