import { BottomNav, Sidebar } from "@/components/shell/navigation";
import { OfflineBanner } from "@/components/shell/pwa";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineBanner />
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-5 pt-4 pb-32 lg:gap-6 lg:px-10 lg:pt-8 lg:pb-12">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
