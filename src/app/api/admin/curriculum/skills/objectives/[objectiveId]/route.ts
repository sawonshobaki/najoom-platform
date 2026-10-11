import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/authorization";
import { addSkillToLearningObjective, SkillServiceError } from "@/lib/curriculum/curriculum-service";
import { readSkillBody, skillErrorResponse } from "../../skill-request";

type RouteContext = { params: Promise<{ objectiveId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { objectiveId } = await context.params;
    const body = await readSkillBody(request);
    if (typeof body.skillId !== "string") throw new SkillServiceError("invalid_skill_id");
    const link = await addSkillToLearningObjective(objectiveId, body.skillId);
    return NextResponse.json({ success: true, link }, { status: 201 });
  } catch (error) { return skillErrorResponse(error); }
}
