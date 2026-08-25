import type { ReactNode } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-panel">
      <AdminSidebar />
      <main className="min-w-0 flex-1 overflow-y-auto px-10 py-10">
        <div className="mx-auto w-full max-w-[1600px]">{children}</div>
      </main>
    </div>
  );
}
