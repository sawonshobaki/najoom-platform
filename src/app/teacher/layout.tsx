import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import {
  AuthenticationRequiredError,
  AuthorizationDeniedError,
  requireTeacher,
} from "@/lib/auth/authorization";

type TeacherLayoutProps = {
  children: ReactNode;
};

export default async function TeacherLayout({
  children,
}: TeacherLayoutProps) {
  try {
    await requireTeacher();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect("/login");
    }

    if (error instanceof AuthorizationDeniedError) {
      redirect("/dashboard");
    }

    throw error;
  }

  return children;
}
