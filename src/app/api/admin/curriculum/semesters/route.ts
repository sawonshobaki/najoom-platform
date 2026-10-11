import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/authorization";
import { createSemester, CurriculumServiceError } from "@/lib/curriculum/curriculum-service";
import { parseSemesterInput, readSemesterBody, semesterErrorResponse } from "./semester-request";

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await readSemesterBody(request);
    if (typeof body.gradeId !== "string") {
      throw new CurriculumServiceError("invalid_grade_id");
    }
    const semester = await createSemester({
      gradeId: body.gradeId,
      ...parseSemesterInput(body),
    });
    return NextResponse.json({ success: true, semester }, { status: 201 });
  } catch (error) {
    return semesterErrorResponse(error);
  }
}
