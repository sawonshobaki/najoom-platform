import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/authorization";
import { createUnit, UnitServiceError } from "@/lib/curriculum/curriculum-service";
import { readUnitBody, parseUnitInput, unitErrorResponse } from "./unit-request";

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await readUnitBody(request);
    if (typeof body.semesterId !== "string") throw new UnitServiceError("invalid_semester_id");
    const unit = await createUnit({ semesterId: body.semesterId, ...parseUnitInput(body) });
    return NextResponse.json({ success: true, unit }, { status: 201 });
  } catch (error) {
    return unitErrorResponse(error);
  }
}
