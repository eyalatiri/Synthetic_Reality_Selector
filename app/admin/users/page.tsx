"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { AdminPageHeader, AdminPrimaryButton } from "@/components/admin/AdminPageHeader";
import { AdminStat } from "@/components/admin/AdminCard";
import { Table, THead, Th, Tr, Td, StatusBadge, formatTunisTime } from "@/components/admin/table/Table";
import { ActionsMenu } from "@/components/admin/table/ActionsMenu";
import { UserFormModal } from "@/components/admin/users/UserFormModal";
import { RoleBadge, initials, userStatusTone } from "@/components/admin/users/user-visuals";
import type { UserProfile, UserRole } from "@/lib/admin/types";

type RoleFilter = "all" | UserRole;

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  // undefined = closed, null = create, UserProfile = edit
  const [editing, setEditing] = useState<UserProfile | null | undefined>(undefined);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    return fetch("/api/admin/users")
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load users");
        return res.json();
      })
      .then((data: UserProfile[]) => setUsers(data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load users"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refetch();
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((me) => setCurrentUserId(me?.id ?? null))
      .catch(() => {});
  }, [refetch]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (!q) return true;
      return [u.fullName, u.email, u.department].some((v) => v.toLowerCase().includes(q));
    });
  }, [users, query, roleFilter]);

  const admins = users.filter((u) => u.role === "admin").length;
  const suspended = users.filter((u) => u.status === "Suspended").length;

  return (
    <>
      <AdminPageHeader
        title="Users"
        subtitle="Who can sign in, and what they can open. Employees go straight to the experience; administrators can use both."
        action={
          <AdminPrimaryButton onClick={() => setEditing(null)}>
            <span className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> Add user
            </span>
          </AdminPrimaryButton>
        }
      />

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <AdminStat label="Total users" value={String(users.length)} tone="accent" />
        <AdminStat label="Administrators" value={String(admins)} />
        <AdminStat label="Employees" value={String(users.length - admins)} />
        <AdminStat label="Suspended" value={String(suspended)} tone={suspended ? "warn" : "default"} />
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, department"
            aria-label="Search users"
            className="w-full rounded-full border border-stone-300 bg-white py-2.5 pl-10 pr-4 text-sm placeholder:text-stone-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>
        <div role="group" aria-label="Filter by role" className="flex rounded-full border border-stone-300 bg-white p-1">
          {(["all", "admin", "employee"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRoleFilter(value)}
              aria-pressed={roleFilter === value}
              className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                roleFilter === value ? "bg-ink text-white" : "text-stone-500 hover:text-stone-800"
              }`}
            >
              {value === "all" ? "All" : value === "admin" ? "Admins" : "Employees"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {error ? (
          <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
        ) : loading && users.length === 0 ? (
          <p className="text-sm text-stone-500">Loading users…</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-stone-500">{users.length === 0 ? "No users yet." : "No users match your filters."}</p>
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>User</Th>
                <Th>Department</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Last sign-in</Th>
                <Th>Created</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </THead>
            <tbody>
              {visible.map((user) => {
                const isSelf = user.id === currentUserId;
                return (
                  <Tr key={user.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">
                          {initials(user.fullName, user.email)}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-stone-900">
                            {user.fullName || user.email}
                            {isSelf ? <span className="ml-2 text-xs font-normal text-stone-400">(you)</span> : null}
                          </div>
                          {user.fullName ? <div className="truncate text-xs text-stone-500">{user.email}</div> : null}
                        </div>
                      </div>
                    </Td>
                    <Td>{user.department || <span className="text-stone-300">—</span>}</Td>
                    <Td>
                      <RoleBadge role={user.role} />
                    </Td>
                    <Td>
                      <StatusBadge label={user.status} tone={userStatusTone(user.status)} />
                    </Td>
                    <Td className="whitespace-nowrap text-stone-500">
                      {user.lastSignInAt ? formatTunisTime(user.lastSignInAt) : "Never"}
                    </Td>
                    <Td className="whitespace-nowrap text-stone-500">{formatTunisTime(user.createdAt)}</Td>
                    <Td className="text-right">
                      <ActionsMenu variant="user" user={user} isSelf={isSelf} onEdit={setEditing} onChanged={refetch} />
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </div>

      {editing !== undefined && (
        <UserFormModal
          user={editing}
          isSelf={editing !== null && editing.id === currentUserId}
          onClose={() => setEditing(undefined)}
          onSaved={refetch}
        />
      )}
    </>
  );
}
