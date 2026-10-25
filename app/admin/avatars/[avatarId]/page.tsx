"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AdminPageHeader, AdminPrimaryButton, AdminSecondaryButton } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AvatarVideoUpload } from "@/components/admin/avatar/AvatarVideoUpload";
import type { Avatar, OwnerType, BodyType, PublishState } from "@/lib/admin/types";

const OWNER_TYPES: OwnerType[] = ["Organisation", "Individual"];
const BODY_TYPES: BodyType[] = ["Full body", "Half body", "Head only"];
const STATUSES: PublishState[] = ["Private", "Public", "Archived"];

type FormState = {
  name: string;
  owner: string;
  ownerType: OwnerType;
  bodyType: BodyType;
  imageUrl: string;
  videoUrl: string | null;
  status: PublishState;
};

const EMPTY_FORM: FormState = {
  name: "",
  owner: "",
  ownerType: "Organisation",
  bodyType: "Half body",
  imageUrl: "",
  videoUrl: null,
  status: "Private",
};

export default function AvatarEditPage() {
  const router = useRouter();
  const params = useParams<{ avatarId: string }>();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [videoProcessing, setVideoProcessing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/avatars/${params.avatarId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load avatar");
        return res.json();
      })
      .then((data: Avatar) => {
        if (cancelled) return;
        setForm({
          name: data.name,
          owner: data.owner,
          ownerType: data.ownerType,
          bodyType: data.bodyType,
          imageUrl: data.imageUrl ?? "",
          videoUrl: data.videoUrl ?? null,
          status: data.status,
        });
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load avatar");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.avatarId]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setSaveError("Name is required.");
      return;
    }
    if (!form.owner.trim()) {
      setSaveError("Owner is required.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/admin/avatars/${params.avatarId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          owner: form.owner,
          ownerType: form.ownerType,
          bodyType: form.bodyType,
          imageUrl: form.imageUrl.trim() || null,
          // null clears the video; the PATCH route accepts string | null.
          videoUrl: form.videoUrl,
          status: form.status,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to save avatar");
      router.push("/admin/avatars");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save avatar");
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <>
        <AdminPageHeader title="Edit avatar" />
        <p className="mt-8 text-sm text-stone-500">Loading…</p>
      </>
    );
  }

  if (loadError) {
    return (
      <>
        <AdminPageHeader title="Edit avatar" />
        <p className="mt-8 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{loadError}</p>
      </>
    );
  }

  return (
    <>
      <AdminPageHeader title={`Edit ${form.name}`} subtitle="Update this avatar's details." />

      <div className="mt-8 max-w-2xl">
        <AdminCard>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-stone-700">Name</span>
                <input
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="e.g. Aura"
                  className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-accent"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-stone-700">Owner</span>
                <input
                  value={form.owner}
                  onChange={(e) => update("owner", e.target.value)}
                  placeholder="e.g. PwC Tunisia"
                  className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-accent"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-stone-700">Owner type</span>
                <select
                  value={form.ownerType}
                  onChange={(e) => update("ownerType", e.target.value as OwnerType)}
                  className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-accent"
                >
                  {OWNER_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-stone-700">Body type</span>
                <select
                  value={form.bodyType}
                  onChange={(e) => update("bodyType", e.target.value as BodyType)}
                  className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-accent"
                >
                  {BODY_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-stone-700">Image URL</span>
              <input
                value={form.imageUrl}
                onChange={(e) => update("imageUrl", e.target.value)}
                placeholder="https://…"
                className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-accent"
              />
            </label>

            <AvatarVideoUpload
              value={form.videoUrl}
              onChange={(url) => update("videoUrl", url)}
              onProcessingChange={setVideoProcessing}
            />

            <label className="block sm:w-1/2">
              <span className="mb-1.5 block text-sm font-medium text-stone-700">Status</span>
              <select
                value={form.status}
                onChange={(e) => update("status", e.target.value as PublishState)}
                className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-accent"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
        </AdminCard>

        {saveError ? (
          <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{saveError}</p>
        ) : null}

        <div className="mt-6 flex items-center justify-between">
          <AdminSecondaryButton onClick={() => router.push("/admin/avatars")}>Cancel</AdminSecondaryButton>
          <AdminPrimaryButton onClick={handleSave} disabled={saving || videoProcessing}>
            {saving ? "Saving…" : videoProcessing ? "Processing video…" : "Save changes"}
          </AdminPrimaryButton>
        </div>
      </div>
    </>
  );
}
