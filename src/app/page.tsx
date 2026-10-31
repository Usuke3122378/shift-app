import NameList from "@/components/NameList";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold">シフト管理</h1>
      <p className="mb-6 text-zinc-600">自分の名前を選んでください</p>
      <NameList />
    </main>
  );
}
