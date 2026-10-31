"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/client-api";
import { saveName, useSavedName } from "@/lib/member-storage";
import type { Member } from "@/lib/types";

// 「/」名前を選ぶ（F-01）。名前を覚えていれば選ばずに /me へ進む
export default function NameList() {
  const router = useRouter();
  const savedName = useSavedName();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (savedName) router.replace("/me");
  }, [savedName, router]);

  useEffect(() => {
    let ignore = false;
    fetchJson<{ members: Member[] }>("/api/members")
      .then((data) => {
        if (!ignore) setMembers(data.members);
      })
      .catch((err: Error) => {
        if (!ignore) setError(err.message);
      });
    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  function choose(name: string) {
    saveName(name);
    router.push("/me");
  }

  // 名前を覚えているか分かるまで・/me へ移動するまでは何も出さない（一覧が一瞬見えるのを防ぐ）
  if (savedName === undefined || savedName) return null;

  if (error) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-red-700">{error}</p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setReloadKey((k) => k + 1);
          }}
          className="min-h-11 rounded-lg border border-zinc-300 px-4"
        >
          もう一度読み込む
        </button>
      </div>
    );
  }

  if (!members) return <p className="text-center text-zinc-500">名簿を読み込み中…</p>;

  const groups = [
    { title: "バイト", list: members.filter((m) => m.type !== "社員") },
    { title: "社員", list: members.filter((m) => m.type === "社員") },
  ];

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.title}>
          <h2 className="mb-2 text-sm font-bold text-zinc-500">{group.title}</h2>
          <ul className="grid grid-cols-3 gap-2">
            {group.list.map((m) => (
              <li key={m.name}>
                <button
                  type="button"
                  onClick={() => choose(m.name)}
                  className="min-h-12 w-full rounded-lg border border-zinc-300 bg-white text-lg active:bg-zinc-100"
                >
                  {m.name}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
