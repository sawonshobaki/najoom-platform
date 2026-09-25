import { NextResponse } from "next/server";

import { endCurrentSession } from "@/lib/auth/auth-session";

export async function POST() {
  await endCurrentSession();

  return NextResponse.json(
    {
      success: true,
    },
    {
      status: 200,
    },
  );
}
