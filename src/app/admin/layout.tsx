import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import {
  AuthenticationRequiredError,
  AuthorizationDeniedError,
  requireAdmin,
} from "@/lib/auth/authorization";

type AdminLayoutProps = {
  children: ReactNode;
};

export default async function AdminLayout({
  children,
}: AdminLayoutProps) {
  try {
    await requireAdmin();
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
