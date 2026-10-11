import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/authorization";
import { removeSkillFromLearningObjective } from "@/lib/curriculum/curriculum-service";
import { skillErrorResponse } from "../../../skill-request";

type RouteContext = { params: Promise<{ objectiveId: string; skillId: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  // The pair in the URL identifies the link; no request body is needed.
  void request;
  try {
    await requireAdmin();
    const { objectiveId, skillId } = await context.params;
    const link = await removeSkillFromLearningObjective(objectiveId, skillId);
    return NextResponse.json({ success: true, link });
  } catch (error) { return skillErrorResponse(error); }
}
