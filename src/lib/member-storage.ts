"use client";

// 選んだ名前を localStorage（ブラウザに小さなデータを保存するしくみ）に覚えておく（F-01）
import { useSyncExternalStore } from "react";

const KEY = "shift-app:name";
const CHANGE_EVENT = "shift-app:name-change";

function readName(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    // プライベートブラウズなどで localStorage が使えないときは「覚えていない」扱い
    return null;
  }
}

export function saveName(name: string): void {
  try {
    localStorage.setItem(KEY, name);
  } catch {}
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function clearName(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {}
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/**
 * 覚えている名前。undefined＝まだ読み込み前（サーバーで描くときと、ブラウザで最初に描くとき）、null＝覚えていない
 */
export function useSavedName(): string | null | undefined {
  return useSyncExternalStore(subscribe, readName, () => undefined);
}
