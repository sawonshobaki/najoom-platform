import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/authorization";
import { updateSemester, CurriculumServiceError } from "@/lib/curriculum/curriculum-service";
import { parseSemesterInput, readSemesterBody, semesterErrorResponse } from "../semester-request";

type RouteContext = { params: Promise<{ semesterId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { semesterId } = await context.params;
    const body = await readSemesterBody(request);
    // تعديل الحقول الوصفية فقط؛ يبقى الفصل في صفه الحالي.
    if ("gradeId" in body) {
      throw new CurriculumServiceError("invalid_request_body");
    }
    const semester = await updateSemester(semesterId, parseSemesterInput(body));
    return NextResponse.json({ success: true, semester });
  } catch (error) {
    return semesterErrorResponse(error);
  }
}
