"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/client-api";
import { firstWeekday, monthLabel, nextMonthKey, WEEKDAY_LABELS } from "@/lib/dates";
import { useSavedName } from "@/lib/member-storage";
import { symbolClass } from "@/lib/symbol-style";
import type { Availability, Day, ShiftResponse } from "@/lib/types";

// 画面を開いている間、作成者がスプシで入れたシフトを読み直す間隔
const REFRESH_MS = 30_000;

type Loaded = {
  days: Day[];
  /** スプシで今黄色になっている日 */
  submitted: number[];
  /** 作成者がもうシフトを入れた日（外せない） */
  assigned: Availability["assigned"];
  /** 公開済み（確定）の月は全部の日が変えられない */
  published: boolean;
  /** 画面で選んでいる日（まだ提出していない分も含む） */
  selected: Set<number>;
};

function assignedDays(assigned: Availability["assigned"]): number[] {
  return Object.keys(assigned).map(Number);
}

function isChanged(loaded: Loaded): boolean {
  return (
    loaded.selected.size !== loaded.submitted.length || loaded.submitted.some((d) => !loaded.selected.has(d))
  );
}

/**
 * スプシの最新の状態を画面に合わせる。選び途中（未提出）の日は残し、シフトが入った日だけはスプシの状態にそろえる
 */
function merge(prev: Loaded, fresh: Availability): Loaded {
  const selected = new Set(isChanged(prev) ? prev.selected : fresh.days);
  for (const d of assignedDays(fresh.assigned)) {
    if (fresh.days.includes(d)) selected.add(d);
    else selected.delete(d);
  }
  // 確定したら、選び途中の分は捨ててスプシの状態をそのまま見せる
  if (fresh.published) return { ...prev, submitted: fresh.days, assigned: fresh.assigned, published: true, selected: new Set(fresh.days) };
  return { ...prev, submitted: fresh.days, assigned: fresh.assigned, published: false, selected };
}

// 「/me/availability」翌月の勤務可能日をタップで選んで提出（F-02・F-03）
export default function AvailabilityCalendar() {
  const name = useSavedName();
  if (!name) return null;
  // 名前が分かってから（＝ブラウザで動き出してから）翌月を決める。ページを前もって作るときに今日の日付を使わないため
  const month = nextMonthKey();
  // Next.js はページを移動しても画面の状態を残しておくので、名前が変わったら key で作り直して前の人の日付を出さない
  return <MemberCalendar key={`${name}/${month}`} name={name} month={month} />;
}

function MemberCalendar({ name, month }: { name: string; month: string }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const availabilityUrl = `/api/availability?${new URLSearchParams({ name, month })}`;

  // 最初の読み込み
  useEffect(() => {
    let ignore = false;
    Promise.all([
      fetchJson<ShiftResponse>(`/api/shift?month=${month}`),
      fetchJson<Availability>(availabilityUrl),
    ])
      .then(([shift, availability]) => {
        if (ignore) return;
        setLoaded({
          days: shift.days,
          submitted: availability.days,
          assigned: availability.assigned,
          published: availability.published,
          selected: new Set(availability.days),
        });
      })
      .catch((err: Error) => {
        if (!ignore) setLoadError(err.message);
      });
    return () => {
      ignore = true;
    };
  }, [month, availabilityUrl, reloadKey]);

  // 作成者がスプシでシフトを入れたらすぐ分かるように、画面に戻ってきたときと30秒ごとに読み直す
  useEffect(() => {
    let ignore = false;
    function refresh() {
      if (document.visibilityState !== "visible") return;
      fetchJson<Availability>(availabilityUrl)
        .then((fresh) => {
          if (!ignore) setLoaded((prev) => (prev ? merge(prev, fresh) : prev));
        })
        // 読み直しに失敗しても、今の画面のまま使えるので何もしない
        .catch(() => {});
    }
    const timer = setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      ignore = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [availabilityUrl]);

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

  if (!loaded) return <p className="text-zinc-500">読み込み中…</p>;

  const changed = isChanged(loaded);
  const alreadySubmitted = loaded.submitted.length > 0;

  function toggle(day: number) {
    setMessage(null);
    setLoaded((prev) => {
      if (!prev || prev.published || prev.assigned[day]) return prev;
      const selected = new Set(prev.selected);
      if (selected.has(day)) selected.delete(day);
      else selected.add(day);
      return { ...prev, selected };
    });
  }

  async function submit() {
    if (!loaded) return;
    setSending(true);
    setMessage(null);
    const requested = [...loaded.selected].sort((a, b) => a - b);
    try {
      const fresh = await fetchJson<Availability>("/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, month, days: requested }),
      });
      setLoaded((prev) => (prev ? { ...merge(prev, fresh), selected: new Set(fresh.days) } : prev));
      // 提出する直前に作成者がシフトを入れていた日は、スプシ側で変えずに残している
      const blocked = assignedDays(fresh.assigned).filter(
        (d) => requested.includes(d) !== fresh.days.includes(d),
      );
      setMessage(
        blocked.length > 0
          ? {
              kind: "error",
              text: `${blocked.map((d) => `${d}日`).join("・")}はもうシフトが入っていたので変更できませんでした。ほかの日は提出しました`,
            }
          : { kind: "ok", text: "提出しました。スプシに反映されています" },
      );
    } catch (err) {
      setMessage({ kind: "error", text: (err as Error).message });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">{monthLabel(month)}の勤務可能日</h1>
        {loaded.published ? (
          <p className="mt-2 rounded-lg bg-zinc-100 p-3 text-sm text-zinc-700">
            {monthLabel(month)}のシフトは確定しました。出した日は変えられません。変更したいときは作成者に連絡してください
          </p>
        ) : (
          <p className="text-sm text-zinc-600">入れる日をタップ（もう一度タップで取り消し）。締め切りは毎月20日です</p>
        )}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_LABELS.map((w, i) => (
          <div
            key={w}
            className={`text-xs font-bold ${i === 0 ? "text-red-600" : i === 6 ? "text-blue-600" : "text-zinc-500"}`}
          >
            {w}
          </div>
        ))}
        {Array.from({ length: firstWeekday(month) }, (_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {loaded.days.map((day) => {
          const on = loaded.selected.has(day.day);
          const red = day.weekday === "日" || day.holiday !== "";
          const blue = day.weekday === "土" && !red;
          const symbol = loaded.assigned[day.day];
          if (symbol) {
            // 作成者がもうシフトを入れた日は押せない
            return (
              <div
                key={day.day}
                aria-label={`${day.day}日（${day.weekday}）シフト「${symbol}」が入っています`}
                className="flex min-h-12 flex-col items-center justify-center rounded-lg border border-zinc-200 bg-zinc-100 text-lg text-zinc-500"
              >
                {day.day}
                <span className={`rounded px-1 text-[11px] font-bold leading-tight ${symbolClass(symbol)}`}>
                  {symbol}
                </span>
              </div>
            );
          }
          const dayClass = `flex min-h-12 flex-col items-center justify-center rounded-lg border text-lg ${
            on ? "border-amber-400 bg-amber-200 font-bold" : "border-zinc-200 bg-white"
          } ${red ? "text-red-600" : blue ? "text-blue-600" : "text-zinc-900"}`;
          if (loaded.published) {
            // 確定した月は見るだけ
            return (
              <div
                key={day.day}
                aria-label={`${day.day}日（${day.weekday}）${on ? "出した日" : ""}`}
                className={dayClass}
              >
                {day.day}
                {day.holiday && <span className="text-[10px] leading-none">祝</span>}
              </div>
            );
          }
          return (
            <button
              key={day.day}
              type="button"
              onClick={() => toggle(day.day)}
              aria-pressed={on}
              aria-label={`${day.day}日（${day.weekday}${day.holiday ? `・${day.holiday}` : ""}）`}
              className={dayClass}
            >
              {day.day}
              {day.holiday && <span className="text-[10px] leading-none">祝</span>}
            </button>
          );
        })}
      </div>

      {/* 画面で黄色になっている日だけを数える（シフトが入ったグレーの日は別に数える） */}
      <p className="text-sm text-zinc-600">
        {loaded.published ? "出した日" : "選んだ日"}：{[...loaded.selected].filter((d) => !loaded.assigned[d]).length}日
        {assignedDays(loaded.assigned).length > 0 && `／シフトが入っている日：${assignedDays(loaded.assigned).length}日`}
      </p>

      {!loaded.published && assignedDays(loaded.assigned).length > 0 && (
        <p className="rounded-lg bg-zinc-100 p-3 text-sm text-zinc-700">
          L・F・早・遅 が付いた日は、もうシフトが決まっているので変えられません。変えたいときは作成者に連絡してください
        </p>
      )}

      {message && (
        <p className={message.kind === "ok" ? "text-green-700" : "text-red-700"} role="status">
          {message.text}
        </p>
      )}

      {!loaded.published && (
        <button
          type="button"
          onClick={submit}
          disabled={sending || (alreadySubmitted && !changed)}
          className="min-h-12 w-full rounded-lg bg-blue-600 text-lg font-bold text-white disabled:bg-zinc-300 disabled:text-zinc-600"
        >
          {sending ? "送信中…" : alreadySubmitted && !changed ? "提出済み ✓" : alreadySubmitted ? "出し直す" : "提出する"}
        </button>
      )}
    </div>
  );
}
