"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, MonitorPlay } from "lucide-react";
import { adminNavItems, isNavItemActive } from "./nav-config";

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex h-screen w-[88px] shrink-0 flex-col items-center gap-8 bg-ink py-6"
      aria-label="Admin navigation"
    >
      <Link
        href="/admin"
        className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent font-serif text-xl font-semibold text-white shadow-[0_0_24px_-4px_rgba(255,109,0,0.65)] transition-transform hover:scale-105"
        aria-label="PwC admin home"
      >
        P
      </Link>

      <nav className="flex flex-1 flex-col items-center gap-2">
        {adminNavItems.map((item) => {
          const active = isNavItemActive(pathname, item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.id}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={`group relative flex h-12 w-12 items-center justify-center rounded-2xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 ${
                active
                  ? "bg-accent/15 text-accent"
                  : "text-white/40 hover:bg-white/5 hover:text-white/80"
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />

              {/* Tooltip on hover — icon-only rail needs a visible label */}
              <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Admins can use both sides of the app: jump to the employee
          experience, or sign out. */}
      <div className="flex flex-col items-center gap-2">
        <Link
          href="/experience"
          aria-label="Open employee experience"
          className="group relative flex h-12 w-12 items-center justify-center rounded-2xl text-white/40 transition-colors hover:bg-white/5 hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
        >
          <MonitorPlay className="h-5 w-5" strokeWidth={1.75} />
          <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
            Employee view
          </span>
        </Link>

        <form action="/auth/signout" method="post">
          <button
            type="submit"
            aria-label="Sign out"
            className="group relative flex h-12 w-12 items-center justify-center rounded-2xl text-white/40 transition-colors hover:bg-white/5 hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
          >
            <LogOut className="h-5 w-5" strokeWidth={1.75} />
            <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
              Sign out
            </span>
          </button>
        </form>
      </div>
    </aside>
  );
}
