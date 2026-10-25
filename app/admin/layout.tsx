import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { getSessionProfile } from "@/lib/auth/guards";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // proxy.ts already keeps non-admins out of /admin; this re-checks on the
  // server so the panel stays protected even if the proxy matcher changes.
  const session = await getSessionProfile();
  if (!session) redirect("/");
  if (session.role !== "admin") redirect("/experience");

  return (
    <div className="flex min-h-screen bg-panel">
      <AdminSidebar />
      <main className="min-w-0 flex-1 overflow-y-auto px-10 py-10">
        <div className="mx-auto w-full max-w-[1600px]">{children}</div>
      </main>
    </div>
  );
}
