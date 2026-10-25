// Shared by proxy.ts (edge-safe: no server-only imports here), the guards,
// the admin UI and the DTO mappers.
export type UserRole = "employee" | "admin";
export type UserStatus = "Active" | "Suspended";

export const USER_ROLES: UserRole[] = ["employee", "admin"];
export const USER_STATUSES: UserStatus[] = ["Active", "Suspended"];

/** Where each role lands right after signing in. */
export const HOME_BY_ROLE: Record<UserRole, string> = {
  employee: "/experience", // employees skip the role chooser entirely
  admin: "/select-role", // admins choose between /experience and /admin
};

/**
 * Only allow same-site relative paths in `?next=` - blocks open redirects
 * like `//evil.com` or `https://evil.com`.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}
