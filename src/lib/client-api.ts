// ブラウザから自分の /api を呼ぶ関数。エラーのときは API が返した文を Error にして投げる

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new Error("通信できませんでした。電波のよい所でもう一度試してください");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `エラーが起きました（${res.status}）`);
  return data as T;
}
