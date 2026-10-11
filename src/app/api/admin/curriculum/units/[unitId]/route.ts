import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/authorization";
import { updateUnit, UnitServiceError } from "@/lib/curriculum/curriculum-service";
import { readUnitBody, parseUnitInput, unitErrorResponse } from "../unit-request";

type RouteContext = { params: Promise<{ unitId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { unitId } = await context.params;
    const body = await readUnitBody(request);
    if ("semesterId" in body) throw new UnitServiceError("invalid_request_body");
    const unit = await updateUnit(unitId, parseUnitInput(body));
    return NextResponse.json({ success: true, unit });
  } catch (error) {
    return unitErrorResponse(error);
  }
}
