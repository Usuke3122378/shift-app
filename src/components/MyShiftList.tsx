"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { fetchJson } from "@/lib/client-api";
import { currentMonthKey, firstWeekday, monthLabel, nextMonthKey, WEEKDAY_LABELS } from "@/lib/dates";
import { useSavedName } from "@/lib/member-storage";
import { isBusyDay } from "@/lib/shift-rules";
import { symbolClass } from "@/lib/symbol-style";
import type { ShiftResponse } from "@/lib/types";
import DayMembersSheet from "./DayMembersSheet";

type View = "work" | "all";

// 「/me」自分のシフト（F-04）。今月と来月を切り替え、日付タップでその日のメンバー（F-05）
export default function MyShiftList() {
  const name = useSavedName();
  if (!name) return null;
  // 名前が分かってから（＝ブラウザで動き出してから）今月を決める。ページを前もって作るときに今日の日付を使わないため
  const current = currentMonthKey();
  // 名前が変わったら key で作り直して、前の人のシフトを出さない
  return <MemberShift key={`${name}/${current}`} name={name} current={current} next={nextMonthKey()} />;
}

function MemberShift({ name, current, next }: { name: string; current: string; next: string }) {
  const [shifts, setShifts] = useState<ShiftResponse[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [chosenMonth, setChosenMonth] = useState<string | null>(null);
  const [view, setView] = useState<View>("work");
  const [openDay, setOpenDay] = useState<number | null>(null);

  const load = useCallback(
    () => Promise.all([current, next].map((m) => fetchJson<ShiftResponse>(`/api/shift?month=${m}`))),
    [current, next],
  );

  useEffect(() => {
    let ignore = false;
    load()
      .then((data) => {
        if (!ignore) setShifts(data);
      })
      .catch((err: Error) => {
        if (!ignore) setLoadError(err.message);
      });
    return () => {
      ignore = true;
    };
  }, [load, reloadKey]);

  // 作成者が「公開する」にチェックを入れたら分かるように、画面に戻ってきたときに読み直す
  useEffect(() => {
    let ignore = false;
    function refresh() {
      if (document.visibilityState !== "visible") return;
      load()
        .then((data) => {
          if (!ignore) setShifts(data);
        })
        .catch(() => {});
    }
    document.addEventListener("visibilitychange", refresh);
    return () => {
      ignore = true;
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);

  // 別のタブへ移動したら小窓を閉じる（Next.js は移動しても画面の状態を残すので、戻ったときに開いたままにしない）
  useLayoutEffect(() => () => setOpenDay(null), []);

  const closeSheet = useCallback(() => setOpenDay(null), []);

  if (loadError) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-red-700">{loadError}</p>
        <button
          type="button"
          onClick={() => {
            setLoadError(null);
            setReloadKey((k) => k + 1);
          }}
          className="min-h-11 rounded-lg border border-zinc-300 px-4"
        >
          もう一度読み込む
        </button>
      </div>
    );
  }

  if (!shifts) return <p className="text-zinc-500">読み込み中…</p>;

  // 最初に開く月：公開済みの月（両方なら今月）
  const month = chosenMonth ?? shifts.find((s) => s.published)?.month ?? current;
  const shift = shifts.find((s) => s.month === month)!;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="月">
        {shifts.map((s) => (
          <button
            key={s.month}
            type="button"
            role="tab"
            aria-selected={s.month === month}
            onClick={() => {
              setChosenMonth(s.month);
              setOpenDay(null);
            }}
            className={`min-h-11 rounded-lg border font-bold ${
              s.month === month ? "border-blue-600 bg-blue-50 text-blue-700" : "border-zinc-300 text-zinc-600"
            }`}
          >
            {monthLabel(s.month)}
            {!s.published && <span className="ml-1 text-xs font-normal">（作成中）</span>}
          </button>
        ))}
      </div>

      {shift.published ? (
        <PublishedShift
          shift={shift}
          name={name}
          view={view}
          onChangeView={setView}
          openDay={openDay}
          onOpenDay={setOpenDay}
          onCloseDay={closeSheet}
        />
      ) : (
        <p className="rounded-lg bg-zinc-100 p-4 text-center text-zinc-700">
          {monthLabel(month)}のシフトは作成中です。公開されるまでお待ちください
        </p>
      )}
    </div>
  );
}

function PublishedShift({
  shift,
  name,
  view,
  onChangeView,
  openDay,
  onOpenDay,
  onCloseDay,
}: {
  shift: Extract<ShiftResponse, { published: true }>;
  name: string;
  view: View;
  onChangeView: (v: View) => void;
  openDay: number | null;
  onOpenDay: (day: number) => void;
  onCloseDay: () => void;
}) {
  const me = shift.rows.find((r) => r.name === name);
  if (!me) {
    return <p className="text-zinc-600">{monthLabel(shift.month)}の表に「{name}」さんの行がありません。作成者に確認してください</p>;
  }

  const workDays = shift.days.filter((_, i) => me.cells[i]);
  const open = openDay === null ? null : shift.days.find((d) => d.day === openDay);

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="font-bold">出勤 {workDays.length}日</p>
        <div className="flex rounded-lg border border-zinc-300 p-0.5 text-sm" role="group" aria-label="表示">
          {(
            [
              ["work", "出勤日だけ"],
              ["all", "1か月全部"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              onClick={() => onChangeView(value)}
              className={`min-h-11 rounded-md px-3 ${view === value ? "bg-zinc-800 text-white" : "text-zinc-600"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === "all" ? (
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAY_LABELS.map((w, i) => (
            <div
              key={w}
              className={`text-xs font-bold ${i === 0 ? "text-red-600" : i === 6 ? "text-blue-600" : "text-zinc-500"}`}
            >
              {w}
            </div>
          ))}
          {Array.from({ length: firstWeekday(shift.month) }, (_, i) => (
            <div key={`blank-${i}`} />
          ))}
          {shift.days.map((day) => {
            const symbol = me.cells[day.day - 1];
            const red = day.weekday === "日" || day.holiday !== "";
            const blue = day.weekday === "土" && !red;
            return (
              <button
                key={day.day}
                type="button"
                onClick={() => onOpenDay(day.day)}
                aria-label={`${day.day}日（${day.weekday}${day.holiday ? `・${day.holiday}` : ""}）${symbol ? `出勤「${symbol}」` : "休み"}`}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg border ${
                  symbol ? "border-amber-400 bg-amber-100" : "border-zinc-200 bg-white"
                } ${red ? "text-red-600" : blue ? "text-blue-600" : "text-zinc-900"}`}
              >
                <span className="text-base leading-none">{day.day}</span>
                {symbol ? (
                  <span className={`rounded px-1 text-[11px] font-bold leading-tight ${symbolClass(symbol)}`}>
                    {symbol}
                  </span>
                ) : (
                  day.holiday && <span className="text-[10px] leading-none">祝</span>
                )}
              </button>
            );
          })}
        </div>
      ) : workDays.length === 0 ? (
        <p className="text-zinc-500">この月の出勤日はありません</p>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
          {workDays.map((day) => {
            const symbol = me.cells[day.day - 1];
            const busy = isBusyDay(day);
            return (
              <li key={day.day}>
                <button
                  type="button"
                  onClick={() => onOpenDay(day.day)}
                  className="flex min-h-12 w-full items-center gap-3 bg-amber-50 px-3 text-left"
                >
                  <span className={`w-20 ${busy ? "text-red-600" : ""}`}>
                    {day.day}日（{day.weekday}）
                  </span>
                  <span className="flex-1 truncate text-xs text-red-600">{day.holiday}</span>
                  <span className={`rounded px-2 py-0.5 text-sm font-bold ${symbolClass(symbol)}`}>{symbol}</span>
                  <span className="text-zinc-400" aria-hidden>
                    ›
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-zinc-500">日付をタップすると、その日に入るメンバーが見られます</p>

      {open && (
        <DayMembersSheet
          monthLabel={monthLabel(shift.month)}
          day={open}
          dayIndex={open.day - 1}
          rows={shift.rows}
          myName={name}
          onClose={onCloseDay}
        />
      )}
    </>
  );
}
