import type { NextRequest } from "next/server";
import { badRequest, errorResponse, getMonth } from "@/lib/apps-script";
import { isMonthKey } from "@/lib/dates";
import type { ShiftResponse } from "@/lib/types";

// GET /api/shift?month=2026-11：その月のシフト表（F-04・F-05）。公開前は中身を返さない（F-10）
export async function GET(request: NextRequest) {
  const month = request.nextUrl.searchParams.get("month");
  if (!isMonthKey(month)) return badRequest("month は 2026-11 の形で指定してください");
  try {
    const { rows, ...data } = await getMonth(month);
    const body: ShiftResponse = data.published ? { ...data, published: true, rows } : { ...data, published: false };
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}
