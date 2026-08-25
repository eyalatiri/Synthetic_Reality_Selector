import type { ReactNode } from "react";

// All the static, server-renderable table pieces live in this one file:
// layout primitives + status/boolean badges + the Tunis date formatter.
// The one thing that needs interactivity (the row actions dropdown) is kept
// in ActionsMenu.tsx instead, since that's the only piece that actually
// needs "use client" — splitting it out keeps everything here a free,
// zero-JS server component.

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-stone-200/70 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="border-b border-stone-200 bg-stone-50/60">{children}</thead>;
}

export function Th({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <th className={`whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500 ${className}`}>
      {children}
    </th>
  );
}

export function Tr({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <tr className={`border-b border-stone-100 last:border-0 hover:bg-stone-50/60 ${className}`}>{children}</tr>;
}

export function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle text-stone-700 ${className}`}>{children}</td>;
}

export type BadgeTone = "success" | "warning" | "danger" | "neutral";

const toneClasses: Record<BadgeTone, string> = {
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-600",
  neutral: "bg-stone-100 text-stone-600",
};

export function StatusBadge({ label, tone }: { label: string; tone: BadgeTone }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${toneClasses[tone]}`}>
      {label}
    </span>
  );
}

export function BooleanBadge({ value }: { value: boolean }) {
  return <StatusBadge label={value ? "Yes" : "No"} tone={value ? "success" : "neutral"} />;
}

export function formatTunisTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Tunis",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
