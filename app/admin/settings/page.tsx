import { Settings } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminComingNext } from "@/components/admin/AdminComingNext";

export default function AdminSettingsPage() {
  return (
    <>
      <AdminPageHeader title="Settings" subtitle="Workspace, billing, and team access." />
      <AdminComingNext
        icon={Settings}
        title="Settings — coming next"
        description="No mockup for this screen yet."
      />
    </>
  );
}
