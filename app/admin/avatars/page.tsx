"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { AdminPageHeader, AdminPrimaryButton } from "@/components/admin/AdminPageHeader";
import { Table, THead, Th, Tr, Td, StatusBadge } from "@/components/admin/table/Table";
import { ActionsMenu } from "@/components/admin/table/ActionsMenu";
import { publishTone } from "@/lib/admin/mock-data"; // keep the helper, drop the array
import type { Avatar } from "@/lib/admin/types";

export default function AvatarsIndexPage() {
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pulled out (was inline in a useEffect) so ActionsMenu's Publish/Archive/
  // Delete actions have something to call via onChanged after they PATCH —
  // the table had no way to refresh itself after a row action before.
  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    return fetch("/api/admin/avatars")
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load avatars");
        return res.json();
      })
      .then((data: Avatar[]) => setAvatars(data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load avatars"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return (
    <>
      <AdminPageHeader
        title="Avatars"
        subtitle="Every digital human you've created, and their current status."
        action={
          <Link href="/admin/avatars/add">
            <AdminPrimaryButton>
              <span className="flex items-center gap-2">
                <Plus className="h-4 w-4" /> Add avatar
              </span>
            </AdminPrimaryButton>
          </Link>
        }
      />

      <div className="mt-8">
        {error ? (
          <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
        ) : loading ? (
          <p className="text-sm text-stone-500">Loading avatars…</p>
        ) : avatars.length === 0 ? (
          <p className="text-sm text-stone-500">No avatars yet — create one to get started.</p>
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Image</Th>
                <Th>Name</Th>
                <Th>Owner</Th>
                <Th>Owner type</Th>
                <Th>Body type</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </THead>
            <tbody>
              {avatars.map((avatar) => (
                <Tr key={avatar.id}>
                  <Td>
                    <Link
                      href={`/admin/avatars/${avatar.id}/persona`}
                      className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 font-serif text-lg font-semibold text-accent"
                    >
                      {avatar.name[0]}
                    </Link>
                  </Td>
                  <Td className="font-medium text-stone-900">
                    <Link href={`/admin/avatars/${avatar.id}/persona`}>{avatar.name}</Link>
                  </Td>
                  <Td>{avatar.owner}</Td>
                  <Td>{avatar.ownerType}</Td>
                  <Td>{avatar.bodyType}</Td>
                  <Td>
                    <StatusBadge label={avatar.status} tone={publishTone(avatar.status)} />
                  </Td>
                  <Td className="text-right">
                    <ActionsMenu variant="avatar" avatar={avatar} onChanged={refetch} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </>
  );
}
