import {
  LayoutDashboard,
  UserCircle2,
  Drama,
  MessageCircle,
  Library,
  Settings,
  Microscope,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AdminNavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
};

// Single source of truth for the admin sidebar. Order here is the visual
// top-to-bottom order in the mockups: Dashboard, Avatars, Conversations,
// Knowledge, Testing lab, Users, Settings.
export const adminNavItems: AdminNavItem[] = [
  { id: "dashboard", label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { id: "avatars", label: "Avatars", href: "/admin/avatars", icon: UserCircle2 },
  { id: "personas", label: "Personas", href: "/admin/personas", icon: Drama },
  { id: "conversations", label: "Conversations", href: "/admin/conversations", icon: MessageCircle },
  { id: "knowledge", label: "Knowledge", href: "/admin/knowledge", icon: Library },
  { id: "testing", label: "Testing lab", href: "/admin/testing", icon: Microscope },
  { id: "users", label: "Users", href: "/admin/users", icon: Users },
  { id: "settings", label: "Settings", href: "/admin/settings", icon: Settings },
];

/**
 * Returns true if `pathname` falls under `href` (used to light up the
 * matching sidebar icon for nested routes like /admin/avatars/new).
 */
export function isNavItemActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}
