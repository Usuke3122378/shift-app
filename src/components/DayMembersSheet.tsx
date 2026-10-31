"use client";

import { useEffect } from "react";
import { countDay, requiredCount, SHIFT_SYMBOLS } from "@/lib/shift-rules";
import { symbolClass } from "@/lib/symbol-style";
import type { Day, ShiftRow } from "@/lib/types";

// 日付をタップすると下から出る小窓：その日に入る全員と L/F/早/遅（F-05）
export default function DayMembersSheet({
  monthLabel,
  day,
  dayIndex,
  rows,
  myName,
  onClose,
}: {
  monthLabel: string;
  day: Day;
  dayIndex: number;
  rows: ShiftRow[];
  myName: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const members = rows
    .filter((r) => r.cells[dayIndex])
    .sort(
      (a, b) =>
        SHIFT_SYMBOLS.indexOf(a.cells[dayIndex] as (typeof SHIFT_SYMBOLS)[number]) -
        SHIFT_SYMBOLS.indexOf(b.cells[dayIndex] as (typeof SHIFT_SYMBOLS)[number]),
    );
  const count = countDay(rows, dayIndex);
  const required = requiredCount(day);

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-members-title"
        onClick={(e) => e.stopPropagation()}
        className="mx-auto max-h-[75vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id="day-members-title" className="text-lg font-bold">
            {monthLabel}
            {day.day}日（{day.weekday}）{day.holiday && <span className="ml-1 text-sm text-red-600">{day.holiday}</span>}
          </h2>
          <button type="button" onClick={onClose} className="min-h-11 min-w-11 text-zinc-500" aria-label="閉じる">
            ✕
          </button>
        </div>

        <p className="mb-3 text-sm text-zinc-600">
          人数 {count.total}人／必要 {required}人
        </p>

        {members.length === 0 ? (
          <p className="text-zinc-500">この日はまだだれも入っていません</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {members.map((m) => (
              <li key={m.name} className="flex min-h-12 items-center justify-between">
                <span className={m.name === myName ? "font-bold" : ""}>
                  {m.name}
                  {m.name === myName && <span className="ml-1 text-xs text-zinc-500">（自分）</span>}
                  {m.type === "社員" && <span className="ml-1 text-xs text-zinc-500">社員</span>}
                </span>
                <span className={`rounded px-2 py-0.5 text-sm font-bold ${symbolClass(m.cells[dayIndex])}`}>
                  {m.cells[dayIndex]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
