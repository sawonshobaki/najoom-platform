import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/auth-session";
import { getRoleHomePath } from "@/lib/auth/role-navigation";

export default async function DashboardPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  redirect(getRoleHomePath(currentUser.role));
}
