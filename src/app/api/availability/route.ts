import type { NextRequest } from "next/server";
import { badRequest, errorResponse, getAvailability, submitAvailability } from "@/lib/apps-script";
import { daysInMonth, isMonthKey } from "@/lib/dates";

// GET /api/availability?name=佐藤&month=2026-11：その人が出している勤務可能日
export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name")?.trim();
  const month = request.nextUrl.searchParams.get("month");
  if (!name) return badRequest("name がありません");
  if (!isMonthKey(month)) return badRequest("month は 2026-11 の形で指定してください");
  try {
    return Response.json({ days: await getAvailability(name, month) });
  } catch (err) {
    return errorResponse(err);
  }
}

// POST /api/availability  本文 {name, month, days}：勤務可能日を提出（F-03）
export async function POST(request: NextRequest) {
  let body: { name?: unknown; month?: unknown; days?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("本文が JSON ではありません");
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const { month, days } = body;
  if (!name) return badRequest("name がありません");
  if (!isMonthKey(month)) return badRequest("month は 2026-11 の形で指定してください");
  const max = daysInMonth(month);
  if (!Array.isArray(days) || !days.every((d) => Number.isInteger(d) && d >= 1 && d <= max)) {
    return badRequest(`days は 1〜${max} の数字の配列にしてください`);
  }
  try {
    await submitAvailability(name, month, [...new Set(days as number[])].sort((a, b) => a - b));
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
