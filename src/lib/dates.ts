// 月は "2026-11" の形の文字列で扱う（スプシのシート名と同じ）。「今月」は日本時間で決める

const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isMonthKey(value: unknown): value is string {
  return typeof value === "string" && MONTH_KEY.test(value);
}

function parseMonthKey(key: string): { year: number; month: number } {
  const m = MONTH_KEY.exec(key);
  if (!m) throw new Error(`月の形がおかしいです: ${key}`);
  return { year: Number(m[1]), month: Number(m[2]) };
}

function toMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function currentMonthKey(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return toMonthKey(get("year"), get("month"));
}

export function addMonths(key: string, diff: number): string {
  const { year, month } = parseMonthKey(key);
  const index = year * 12 + (month - 1) + diff;
  return toMonthKey(Math.floor(index / 12), (index % 12) + 1);
}

export function nextMonthKey(now: Date = new Date()): string {
  return addMonths(currentMonthKey(now), 1);
}

/** "2026-11" → "11月" */
export function monthLabel(key: string): string {
  return `${parseMonthKey(key).month}月`;
}

/** "2026-11" → "2026年11月" */
export function monthLabelWithYear(key: string): string {
  const { year, month } = parseMonthKey(key);
  return `${year}年${month}月`;
}

export function daysInMonth(key: string): number {
  const { year, month } = parseMonthKey(key);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** カレンダーの見出し（日曜はじまり） */
export const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;

/** その月の1日が何曜日か（0=日〜6=土）。カレンダーの空きマスに使う */
export function firstWeekday(key: string): number {
  const { year, month } = parseMonthKey(key);
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
}
