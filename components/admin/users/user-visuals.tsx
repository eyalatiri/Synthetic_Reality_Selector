import type { UserRole, UserStatus } from "@/lib/admin/types";

export function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
        role === "admin" ? "bg-accent/10 text-accent" : "bg-stone-100 text-stone-600"
      }`}
    >
      {role}
    </span>
  );
}

export function userStatusTone(status: UserStatus) {
  return status === "Active" ? ("success" as const) : ("danger" as const);
}

export function initials(name: string, email: string) {
  const source = name.trim() || email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** 14-char random password using the browser CSPRNG; avoids look-alike characters. */
export function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => alphabet[n % alphabet.length]).join("");
}
