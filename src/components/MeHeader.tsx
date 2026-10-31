"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { clearName, useSavedName } from "@/lib/member-storage";

// /me の上の帯。名前を覚えていなければ「/」（名前を選ぶ）へ戻す
export default function MeHeader() {
  const router = useRouter();
  const name = useSavedName();

  useEffect(() => {
    if (name === null) router.replace("/");
  }, [name, router]);

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-2">
      <p className="text-lg font-bold">{name ? `${name}さん` : " "}</p>
      <button
        type="button"
        onClick={() => {
          clearName();
          router.push("/");
        }}
        className="min-h-11 px-2 text-sm text-zinc-600 underline"
      >
        名前を変える
      </button>
    </header>
  );
}
