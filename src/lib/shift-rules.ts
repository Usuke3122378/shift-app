// 人数の数え方のルール（docs/requirements.md §1「人数の数え方のルール」）。
// スプシの数式（apps-script/Code.gs の buildTemplate）と同じルールなので、変えるときは両方直す

import type { Day, MonthData, ShiftRow, Shortage } from "./types";
import { monthLabel } from "./dates";

export const SHIFT_SYMBOLS = ["L", "F", "早", "遅"] as const;
export type ShiftSymbol = (typeof SHIFT_SYMBOLS)[number];

export function isShiftSymbol(value: string): value is ShiftSymbol {
  return (SHIFT_SYMBOLS as readonly string[]).includes(value);
}

/** 土日祝か */
export function isBusyDay(day: Day): boolean {
  return day.weekday === "土" || day.weekday === "日" || day.holiday !== "";
}

/** 必要な人数：平日3人／土日祝4人 */
export function requiredCount(day: Day): number {
  return isBusyDay(day) ? 4 : 3;
}

export type DayCount = {
  /** L と F の人数（社員も含む） */
  full: number;
  early: number;
  late: number;
  /** L・F＝1人、早・遅＝0.5人で数えた合計 */
  total: number;
};

export function countDay(rows: ShiftRow[], dayIndex: number): DayCount {
  let full = 0;
  let early = 0;
  let late = 0;
  for (const row of rows) {
    const cell = row.cells[dayIndex];
    if (cell === "L" || cell === "F") full++;
    else if (cell === "早") early++;
    else if (cell === "遅") late++;
  }
  return { full, early, late, total: full + (early + late) * 0.5 };
}

/**
 * 足りない分の書き方。整数部分は「◯枠」、0.5 残れば少ない方の番を「早番1枠／遅番1枠」とする。
 * 例：2 → "2枠"、0.5（早1・遅0）→ "遅番1枠"、1.5 → "1枠・遅番1枠"
 */
export function shortageLabel(short: number, count: DayCount): string {
  const whole = Math.floor(short);
  const parts: string[] = [];
  if (whole > 0) parts.push(`${whole}枠`);
  if (short - whole > 0) parts.push(count.early > count.late ? "遅番1枠" : "早番1枠");
  return parts.join("・");
}

/** 足りない日の一覧（F-11） */
export function findShortages(data: Pick<MonthData, "days" | "rows">): Shortage[] {
  const shortages: Shortage[] = [];
  data.days.forEach((day, i) => {
    const count = countDay(data.rows, i);
    const short = requiredCount(day) - count.total;
    if (short <= 0) return;
    shortages.push({
      day: day.day,
      weekday: day.weekday,
      holiday: day.holiday,
      short,
      label: shortageLabel(short, count),
    });
  });
  return shortages;
}

/** 再募集の LINE 文面（F-12）。形は docs/requirements.md 付録D に合わせる */
export function buildRecruitMessage(month: string, shortages: Shortage[], comment: string): string {
  const lines = ["@All", `${monthLabel(month)}のシフトです！`];
  const trimmed = comment.trim();
  if (trimmed !== "") lines.push(trimmed);
  lines.push(
    "",
    "下記欠員日となります。",
    "ご協力のほど、よろしくお願いいたします。",
    "",
    "【欠員】",
    ...shortages.map((s) => `${s.day}日　${s.label}`),
  );
  return lines.join("\n");
}
