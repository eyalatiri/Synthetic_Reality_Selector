import type { ReactNode, HTMLAttributes } from "react";

type DivProps = HTMLAttributes<HTMLDivElement>;

/** White rounded card on the cream page background. Used for stat tiles, list rows, form sections. */
export function AdminCard({ className = "", children, ...rest }: DivProps) {
  return (
    <div
      className={`rounded-2xl border border-stone-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

/**
 * Near-black "live" panel — the signature device used for anything real-time
 * or AI-generated: the live test session transcript, the session audio +
 * transcript viewer, the behaviour/appearance preview. Keeps the light admin
 * chrome quiet while making AI output feel distinct and alive.
 */
export function AdminLivePanel({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`rounded-3xl bg-ink p-6 text-white ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function AdminStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "accent" | "warn";
}) {
  const toneClass =
    tone === "accent" ? "text-accent" : tone === "warn" ? "text-red-500" : "text-emerald-600";

  return (
    <AdminCard className="p-5">
      <div className={`text-3xl font-semibold ${toneClass}`}>{value}</div>
      <div className="mt-1 text-sm text-stone-500">{label}</div>
    </AdminCard>
  );
}
