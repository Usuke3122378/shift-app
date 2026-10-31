import type { Metadata } from "next";
import ShortagePanel from "@/components/ShortagePanel";

export const metadata: Metadata = {
  title: "足りない日・再募集｜シフト管理",
};

export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold">足りない日・再募集</h1>
      <ShortagePanel />
    </main>
  );
}
