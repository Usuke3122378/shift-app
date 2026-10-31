import type { NextRequest } from "next/server";
import { badRequest, errorResponse, getMonth } from "@/lib/apps-script";
import { isMonthKey } from "@/lib/dates";
import { findShortages } from "@/lib/shift-rules";
import type { ShortageResponse } from "@/lib/types";

// GET /api/shortage?month=2026-11：足りない日の一覧（F-11）。/admin はログインなしなので名前は返さない
export async function GET(request: NextRequest) {
  const month = request.nextUrl.searchParams.get("month");
  if (!isMonthKey(month)) return badRequest("month は 2026-11 の形で指定してください");
  try {
    const data = await getMonth(month);
    const body: ShortageResponse = {
      month: data.month,
      exists: data.exists,
      published: data.published,
      shortages: data.exists ? findShortages(data) : [],
    };
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}
