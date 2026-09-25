import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import {
  AuthenticationRequiredError,
  AuthorizationDeniedError,
  requireStudent,
} from "@/lib/auth/authorization";

type StudentLayoutProps = {
  children: ReactNode;
};

export default async function StudentLayout({
  children,
}: StudentLayoutProps) {
  try {
    await requireStudent();
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
