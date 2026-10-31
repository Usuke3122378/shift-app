// Apps Script の窓口を呼ぶ関数。サーバー側（Route Handler）専用。
// URL は .env.local の APPS_SCRIPT_URL。ブラウザに出さないため、このファイルを Client Component から import するとエラーになる
import "server-only";

import type { Member, MonthData } from "./types";

export class AppsScriptError extends Error {}

function scriptUrl(): string {
  const url = process.env.APPS_SCRIPT_URL;
  if (!url) throw new AppsScriptError("APPS_SCRIPT_URL が設定されていません（.env.local を確認）");
  return url;
}

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) throw new AppsScriptError(`Apps Script が ${res.status} を返しました`);
  let data: { ok: boolean; error?: string };
  try {
    data = await res.json();
  } catch {
    // デプロイの「アクセスできるユーザー」が「全員」になっていないと、JSON ではなくログイン画面の HTML が返る
    throw new AppsScriptError("Apps Script の返事が JSON ではありません（デプロイの設定を確認）");
  }
  if (!data.ok) throw new AppsScriptError(data.error ?? "Apps Script でエラーが起きました");
  return data as T;
}

async function callGet<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(scriptUrl());
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return parse<T>(await fetch(url));
}

async function callPost<T>(body: Record<string, unknown>): Promise<T> {
  // Apps Script の POST は別の URL へ転送（リダイレクト）されてから結果が返る。fetch はそれを自動で追いかける
  const res = await fetch(scriptUrl(), {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
  });
  return parse<T>(res);
}

export async function getMembers(): Promise<Member[]> {
  const data = await callGet<{ members: Member[] }>({ action: "members" });
  return data.members;
}

export async function getMonth(month: string): Promise<MonthData> {
  const data = await callGet<MonthData>({ action: "month", month });
  return { month: data.month, exists: data.exists, published: data.published, days: data.days, rows: data.rows };
}

export async function getAvailability(name: string, month: string): Promise<number[]> {
  const data = await callGet<{ days: number[] }>({ action: "availability", name, month });
  return data.days;
}

export async function submitAvailability(name: string, month: string, days: number[]): Promise<void> {
  await callPost({ action: "submitAvailability", name, month, days });
}

/** Route Handler でのエラーの返し方をそろえる */
export function errorResponse(err: unknown): Response {
  console.error(err);
  const message = err instanceof AppsScriptError ? err.message : "サーバーでエラーが起きました";
  return Response.json({ error: message }, { status: 500 });
}

export function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}
