"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/me", label: "自分のシフト" },
  { href: "/me/availability", label: "勤務可能日を出す" },
] as const;

// 画面下の2つのタブ
export default function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-md grid-cols-2">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 items-center justify-center text-sm font-bold ${
                  active ? "border-t-2 border-blue-600 text-blue-700" : "text-zinc-500"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
