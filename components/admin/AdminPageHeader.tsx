import type { ReactNode } from "react";

type AdminPageHeaderProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  breadcrumb?: ReactNode;
};

export function AdminPageHeader({ title, subtitle, action, breadcrumb }: AdminPageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        {breadcrumb ? <div className="mb-2 text-sm text-stone-500">{breadcrumb}</div> : null}
        <h1 className="text-4xl font-semibold tracking-tight text-stone-900">{title}</h1>
        {subtitle ? <p className="mt-2 text-[15px] text-stone-500">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

type AdminPrimaryButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
};

export function AdminPrimaryButton({ children, onClick, type = "button", disabled = false }: AdminPrimaryButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_-6px_rgba(255,109,0,0.55)] transition-transform hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-panel disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
    >
      {children}
    </button>
  );
}

export function AdminSecondaryButton({ children, onClick, type = "button", disabled = false }: AdminPrimaryButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="rounded-full border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}
