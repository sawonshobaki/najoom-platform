import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/authorization";
import { updateSkill } from "@/lib/curriculum/curriculum-service";
import { readSkillBody, parseSkillInput, skillErrorResponse } from "../skill-request";

type RouteContext = { params: Promise<{ skillId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { skillId } = await context.params;
    const skill = await updateSkill(skillId, parseSkillInput(await readSkillBody(request)));
    return NextResponse.json({ success: true, skill });
  } catch (error) { return skillErrorResponse(error); }
}
