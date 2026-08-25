"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, FolderPlus } from "lucide-react";
import { AdminPageHeader, AdminPrimaryButton } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { KnowledgeFolderCard } from "@/components/admin/knowledge/KnowledgeFolderCard";
import { KnowledgeFolderModal } from "@/components/admin/knowledge/KnowledgeFolderModal";
import type { KnowledgeSource } from "@/lib/admin/types";

export default function KnowledgeCenterPage() {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    return fetch("/api/admin/knowledge")
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load knowledge sources");
        return res.json();
      })
      .then((data: KnowledgeSource[]) => setSources(data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load knowledge sources"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Look the open source up fresh from `sources` on every render (rather than
  // holding a snapshot from the moment it was clicked) so the popup reflects
  // any refetch — e.g. its file count after an upload — and closes itself
  // cleanly if the source gets deleted while open.
  const openSource = openId ? (sources.find((s) => s.id === openId) ?? null) : null;

  return (
    <>
      <AdminPageHeader
        title="Knowledge center"
        subtitle="Sources powering your avatars' answers, indexed and continuously verified."
        action={
          <Link href="/admin/knowledge/new">
            <AdminPrimaryButton>
              <span className="flex items-center gap-2">
                <Plus className="h-4 w-4" /> Add knowledge
              </span>
            </AdminPrimaryButton>
          </Link>
        }
      />

      <div className="mt-8">
        {error ? (
          <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
        ) : loading ? (
          <p className="text-sm text-stone-500">Loading knowledge sources…</p>
        ) : sources.length === 0 ? (
          <AdminCard className="flex flex-col items-center gap-4 px-10 py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <FolderPlus className="h-6 w-6" strokeWidth={1.75} />
            </div>
            <div className="max-w-md">
              <h2 className="text-lg font-semibold text-stone-900">No knowledge folders yet</h2>
              <p className="mt-1.5 text-sm text-stone-500">
                Add a source and drop in some files — your avatars will pull answers from it once it's indexed.
              </p>
            </div>
            <Link href="/admin/knowledge/new">
              <AdminPrimaryButton>
                <span className="flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Add knowledge
                </span>
              </AdminPrimaryButton>
            </Link>
          </AdminCard>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sources.map((source) => (
              <KnowledgeFolderCard
                key={source.id}
                source={source}
                onOpen={() => setOpenId(source.id)}
                onChanged={refetch}
              />
            ))}
          </div>
        )}
      </div>

      <KnowledgeFolderModal source={openSource} onClose={() => setOpenId(null)} onChanged={refetch} />
    </>
  );
}
