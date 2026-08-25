import type { LucideIcon } from "lucide-react";
import { AdminCard } from "./AdminCard";

export function AdminComingNext({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <AdminCard className="mt-8 flex flex-col items-center gap-4 px-10 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
        <Icon className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <div className="max-w-md">
        <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
        <p className="mt-1.5 text-sm text-stone-500">{description}</p>
      </div>
    </AdminCard>
  );
}
