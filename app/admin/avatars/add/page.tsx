"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminPageHeader, AdminPrimaryButton, AdminSecondaryButton } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AvatarVideoUpload } from "@/components/admin/avatar/AvatarVideoUpload";
import type { OwnerType, BodyType } from "@/lib/admin/types";

// Deliberately the plain counterpart to the avatar-wizard at
// /admin/avatars/new: that wizard (now linked from the Dashboard as
// "Create simulation") creates an avatar + persona + knowledge + the
// avatar_combinations row that ties them together. This page only calls
// POST /api/admin/avatars — no persona, no knowledge, no combination.
const OWNER_TYPES: OwnerType[] = ["Organisation", "Individual"];
const BODY_TYPES: BodyType[] = ["Full body", "Half body", "Head only"];

export default function AddAvatarPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [ownerType, setOwnerType] = useState<OwnerType>("Organisation");
  const [bodyType, setBodyType] = useState<BodyType>("Half body");
  const [imageUrl, setImageUrl] = useState("");
  // Set by <AvatarVideoUpload /> once /api/admin/avatars/create-video
  // (LivePortrait -> Supabase Storage) has returned a public URL.
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoProcessing, setVideoProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!owner.trim()) {
      setError("Owner is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/avatars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          owner,
          ownerType,
          bodyType,
          imageUrl: imageUrl.trim() || undefined,
          videoUrl: videoUrl ?? undefined,
          // "Draft" isn't a valid PublishState (Private | Public | Archived).
          status: "Private",
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to create avatar");
      router.push("/admin/avatars");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create avatar");
      setSaving(false);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Add avatar"
        subtitle="Just the digital human itself — no persona or knowledge attached yet."
      />

      <div className="mt-8 max-w-2xl">
        <AdminCard>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-stone-700">Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Aura"
                  className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-accent"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-stone-700">Owner</span>
                <input
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  placeholder="e.g. PwC Tunisia"
                  className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-accent"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-stone-700">Owner type</span>
                <select
                  value={ownerType}
                  onChange={(e) => setOwnerType(e.target.value as OwnerType)}
                  className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-accent"
                >
                  {OWNER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-stone-700">Body type</span>
                <select
                  value={bodyType}
                  onChange={(e) => setBodyType(e.target.value as BodyType)}
                  className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-accent"
                >
                  {BODY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-stone-700">Image URL (optional)</span>
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-accent"
              />
            </label>

            <AvatarVideoUpload value={videoUrl} onChange={setVideoUrl} onProcessingChange={setVideoProcessing} />
          </div>
        </AdminCard>

        {error ? (
          <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
        ) : null}

        <div className="mt-6 flex items-center justify-between">
          <AdminSecondaryButton onClick={() => router.push("/admin/avatars")}>Cancel</AdminSecondaryButton>
          <AdminPrimaryButton onClick={handleSave} disabled={saving || videoProcessing}>
            {saving ? "Creating…" : videoProcessing ? "Processing video…" : "Create avatar"}
          </AdminPrimaryButton>
        </div>
      </div>
    </>
  );
}
