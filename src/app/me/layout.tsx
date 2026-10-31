import MeHeader from "@/components/MeHeader";
import TabBar from "@/components/TabBar";

export default function MeLayout({ children }: LayoutProps<"/me">) {
  return (
    <>
      <MeHeader />
      {/* 下のタブに隠れないように、下に余白をとる */}
      <main className="mx-auto w-full max-w-md px-4 pt-4 pb-24">{children}</main>
      <TabBar />
    </>
  );
}
