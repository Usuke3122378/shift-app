"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * ブラウザで動き出したら true。ページを前もって作るとき（サーバー側）は false。
 * 今日の日付を使う部品は、これが true になってから日付を決める
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
