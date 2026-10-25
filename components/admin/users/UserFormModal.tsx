"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Eye, EyeOff, RefreshCw, ShieldCheck, UserRound, X } from "lucide-react";
import { AdminPrimaryButton, AdminSecondaryButton } from "@/components/admin/AdminPageHeader";
import type { UserProfile, UserRole } from "@/lib/admin/types";
import { generatePassword } from "./user-visuals";

const inputClass =
  "w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:bg-stone-50 disabled:text-stone-500";

const ROLE_OPTIONS: { value: UserRole; label: string; description: string; icon: typeof UserRound }[] = [
  {
    value: "employee",
    label: "Employee",
    description: "Signs in straight to the avatar experience. No access to admin.",
    icon: UserRound,
  },
  {
    value: "admin",
    label: "Administrator",
    description: "Can open both the experience and the admin panel, and manage users.",
    icon: ShieldCheck,
  },
];

/**
 * Create / edit dialog. `user` = null means "create"; passing a user switches to
 * edit mode (email is read-only; password becomes an optional reset).
 * Mount it only while open (`{open && <UserFormModal ... />}`) so state resets.
 */
export function UserFormModal({
  user,
  isSelf,
  onClose,
  onSaved,
}: {
  user: UserProfile | null;
  /** Editing your own row: role can't be lowered (the API enforces it too). */
  isSelf?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = user !== null;
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [department, setDepartment] = useState(user?.department ?? "");
  const [role, setRole] = useState<UserRole>(user?.role ?? "employee");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, saving]);

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked - user can still select the text */
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!editing && password.length < 8) return setError("Temporary password must be at least 8 characters.");
    if (editing && password && password.length < 8) return setError("New password must be at least 8 characters.");

    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/admin/users/${user.id}` : "/api/admin/users", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editing ? {} : { email }),
          fullName,
          department,
          role,
          ...(password ? { password } : {}),
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Failed to save user");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save user");
      setSaving(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-label={editing ? "Edit user" : "Add user"}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-stone-100 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-stone-900">{editing ? "Edit user" : "Add user"}</h2>
            <p className="mt-1 text-sm text-stone-500">
              {editing ? user.email : "They can sign in right away with the temporary password."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {error ? (
            <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
              {error}
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-stone-700">Full name</span>
              <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Amel Ben Salah" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-stone-700">Department</span>
              <input className={inputClass} value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Tax & Legal" />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-stone-700">Work email</span>
            <input
              className={inputClass}
              type="email"
              required
              disabled={editing}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@pwc.com"
              autoComplete="off"
            />
          </label>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-stone-700">Role</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ROLE_OPTIONS.map(({ value, label, description, icon: Icon }) => {
                const selected = role === value;
                const locked = isSelf && value !== "admin";
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={locked}
                    onClick={() => setRole(value)}
                    aria-pressed={selected}
                    title={locked ? "You can't remove your own administrator role" : undefined}
                    className={`flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-50 ${
                      selected ? "border-accent bg-accent/5" : "border-stone-200 hover:border-stone-300"
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${selected ? "text-accent" : "text-stone-400"}`} strokeWidth={1.75} />
                    <span className="text-sm font-semibold text-stone-900">{label}</span>
                    <span className="text-xs leading-relaxed text-stone-500">{description}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-stone-700">
              {editing ? "Reset password" : "Temporary password"}
              {editing ? <span className="ml-1 font-normal text-stone-400">(optional)</span> : null}
            </span>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  className={`${inputClass} pr-10 font-mono`}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={editing ? "Leave blank to keep current" : "Min. 8 characters"}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPassword(generatePassword());
                  setShowPassword(true);
                }}
                aria-label="Generate password"
                title="Generate"
                className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-stone-300 text-stone-500 transition-colors hover:bg-stone-50 hover:text-stone-800"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={copyPassword}
                disabled={!password}
                aria-label="Copy password"
                title="Copy"
                className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-stone-300 text-stone-500 transition-colors hover:bg-stone-50 hover:text-stone-800 disabled:opacity-40"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-stone-400">
              Copy it before saving - it can&rsquo;t be viewed again afterwards. Share it with the user securely.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-stone-100 px-6 py-4">
          <AdminSecondaryButton onClick={onClose} disabled={saving}>
            Cancel
          </AdminSecondaryButton>
          <AdminPrimaryButton type="submit" disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Create user"}
          </AdminPrimaryButton>
        </div>
      </form>
    </div>,
    document.body
  );
}
