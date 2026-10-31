"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchJson } from "@/lib/client-api";
import { currentMonthKey, monthLabel, nextMonthKey } from "@/lib/dates";
import { buildRecruitMessage } from "@/lib/shift-rules";
import { useIsClient } from "@/lib/use-is-client";
import type { ShortageResponse } from "@/lib/types";

// 「/admin」足りない日の一覧（F-11）と再募集の LINE 文面のコピー（F-12）。ログインなしなので名前は出さない
export default function ShortagePanel() {
  const isClient = useIsClient();
  if (!isClient) return null;
  // ブラウザで動き出してから今月を決める。ページを前もって作るときに今日の日付を使わないため
  return <Panel current={currentMonthKey()} next={nextMonthKey()} />;
}

function Panel({ current, next }: { current: string; next: string }) {
  // 再募集をかけるのはふつう来月分なので、来月から開く
  const [month, setMonth] = useState(next);
  const [data, setData] = useState<ShortageResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [comment, setComment] = useState("");
  const [copied, setCopied] = useState<"ok" | "error" | null>(null);

  const load = useCallback(() => fetchJson<ShortageResponse>(`/api/shortage?month=${month}`), [month]);

  useEffect(() => {
    let ignore = false;
    load()
      .then((res) => {
        if (ignore) return;
        setData(res);
        setLoadError(null);
      })
      .catch((err: Error) => {
        if (!ignore) setLoadError(err.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [load, reloadKey]);

  // スプシでシフトを直してからこのタブに戻ってきたら、読み直す
  useEffect(() => {
    function refresh() {
      if (document.visibilityState === "visible") setReloadKey((k) => k + 1);
    }
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, []);

  function changeMonth(m: string) {
    setMonth(m);
    setData(null);
    setLoading(true);
    setCopied(null);
  }

  // 表示中のデータが選んでいる月のものか（月を切り替えた直後は前の月のデータを出さない）
  const shown = data && data.month === month ? data : null;
  const message = shown ? buildRecruitMessage(month, shown.shortages, comment) : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied("ok");
    } catch {
      setCopied("error");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {[current, next].map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={m === month}
            onClick={() => changeMonth(m)}
            className={`min-h-11 rounded-lg border px-5 font-bold ${
              m === month ? "border-blue-600 bg-blue-50 text-blue-700" : "border-zinc-300 text-zinc-600"
            }`}
          >
            {monthLabel(m)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setReloadKey((k) => k + 1);
          }}
          className="ml-auto min-h-11 rounded-lg border border-zinc-300 px-4 text-sm text-zinc-700"
        >
          {loading ? "読み込み中…" : "最新にする"}
        </button>
      </div>

      {loadError && (
        <p className="rounded-lg bg-red-50 p-3 text-red-700">
          {loadError}（「最新にする」でもう一度読み込めます）
        </p>
      )}

      {!shown ? (
        !loadError && <p className="text-zinc-500">読み込み中…</p>
      ) : !shown.exists ? (
        <p className="rounded-lg bg-zinc-100 p-4 text-zinc-700">
          {monthLabel(month)}のシートはまだありません。スプシの「シフト → 翌月シートを作る」で作れます（最初の人が勤務可能日を出したときにも自動で作られます）
        </p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <section>
            <h2 className="mb-2 text-lg font-bold">
              足りない日 <span className="text-base font-normal text-zinc-600">{shown.shortages.length}日</span>
            </h2>
            {!shown.published && (
              <p className="mb-2 text-sm text-zinc-500">まだ公開していない（作成中の）表をもとに数えています</p>
            )}
            {shown.shortages.length === 0 ? (
              <p className="rounded-lg bg-green-50 p-4 text-green-800">足りない日はありません</p>
            ) : (
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-zinc-300 text-sm text-zinc-500">
                    <th className="py-2 font-normal">日付</th>
                    <th className="py-2 font-normal">曜日</th>
                    <th className="py-2 font-normal">あと何人</th>
                    <th className="py-2 font-normal">募集の書き方</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.shortages.map((s) => (
                    <tr key={s.day} className="border-b border-zinc-100">
                      <td className="py-2">{s.day}日</td>
                      <td className={`py-2 ${s.weekday === "日" || s.holiday ? "text-red-600" : s.weekday === "土" ? "text-blue-600" : ""}`}>
                        {s.weekday}
                        {s.holiday && <span className="ml-1 text-xs">{s.holiday}</span>}
                      </td>
                      <td className="py-2 font-bold">{s.short}人</td>
                      <td className="py-2">{s.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold">再募集の LINE 文面</h2>
            <label className="block">
              <span className="text-sm text-zinc-600">ひとこと（2〜4行目に入ります。空でもOK）</span>
              <textarea
                value={comment}
                onChange={(e) => {
                  setComment(e.target.value);
                  setCopied(null);
                }}
                rows={3}
                placeholder={"中旬に希望がかなり集中していたため、削っております。\nご了承ください。"}
                className="mt-1 w-full rounded-lg border border-zinc-300 p-2"
              />
            </label>
            <pre className="whitespace-pre-wrap rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-sans text-sm">
              {message}
            </pre>
            <button
              type="button"
              onClick={copy}
              disabled={shown.shortages.length === 0}
              className="min-h-12 w-full rounded-lg bg-green-600 text-lg font-bold text-white disabled:bg-zinc-300 disabled:text-zinc-600"
            >
              文面をコピー
            </button>
            {copied === "ok" && (
              <p className="text-green-700" role="status">
                コピーしました。LINE に貼り付けて送ってください
              </p>
            )}
            {copied === "error" && (
              <p className="text-red-700" role="status">
                コピーできませんでした。上の文面を選んでコピーしてください
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
