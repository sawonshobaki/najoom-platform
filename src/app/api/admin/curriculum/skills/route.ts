import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/authorization";
import { createSkill, listSkills } from "@/lib/curriculum/curriculum-service";
import { readSkillBody, parseSkillInput, skillErrorResponse } from "./skill-request";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({ success: true, skills: await listSkills() });
  } catch (error) { return skillErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const skill = await createSkill(parseSkillInput(await readSkillBody(request)));
    return NextResponse.json({ success: true, skill }, { status: 201 });
  } catch (error) { return skillErrorResponse(error); }
}
