"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AdminPageHeader, AdminPrimaryButton, AdminSecondaryButton } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { QNA_MODELS } from "@/lib/admin/mock-data";
import type { Persona, QnaModel, PublishState } from "@/lib/admin/types";

// This single route replaces the previous app/admin/personas/new/page.tsx —
// delete that file/folder once this is in place. `personaId` is either a
// real persona UUID (edit mode) or the literal string "new" (create mode),
// which is what /admin/personas/new already links to, so no other link
// needs to change.
const STATUSES: PublishState[] = ["Private", "Public", "Archived"];

type FormState = {
  name: string;
  type: string;
  roleTitle: string;
  department: string;
  prompt: string;
  qnaModel: QnaModel;
  creativity: number;
  status: PublishState;
  version: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  type: "",
  roleTitle: "",
  department: "",
  prompt: "",
  qnaModel: "Claude Sonnet",
  creativity: 35,
  status: "Private",
  version: "v1.0",
};

export default function PersonaFormPage() {
  const router = useRouter();
  const params = useParams<{ personaId: string }>();
  const isNew = params.personaId === "new";

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    fetch(`/api/admin/personas/${params.personaId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load persona");
        return res.json();
      })
      .then((data: Persona) => {
        if (cancelled) return;
        setForm({
          name: data.name,
          type: data.type,
          roleTitle: data.roleTitle,
          department: data.department,
          prompt: data.prompt,
          qnaModel: data.qnaModel,
          creativity: data.creativity,
          status: data.status,
          version: data.version,
        });
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load persona");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isNew, params.personaId]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setSaveError("Name is required.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(isNew ? "/api/admin/personas" : `/api/admin/personas/${params.personaId}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isNew ? { ...form, status: "Draft" } : form),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `Failed to ${isNew ? "create" : "save"} persona`);
      router.push("/admin/personas");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : `Failed to ${isNew ? "create" : "save"} persona`);
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <>
        <AdminPageHeader title="Edit persona" />
        <p className="mt-8 text-sm text-stone-500">Loading…</p>
      </>
    );
  }

  if (loadError) {
    return (
      <>
        <AdminPageHeader title="Edit persona" />
        <p className="mt-8 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{loadError}</p>
      </>
    );
  }

  return (
    <>
      <AdminPageHeader
        title={isNew ? "Add persona" : `Edit ${form.name}`}
        subtitle={
          isNew
            ? "Create a standalone persona — link it to an avatar later from the avatar wizard."
            : "Update this persona's details."
        }
      />

      <div className="mt-8 max-w-2xl">
        <AdminCard>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-stone-700">Name</span>
                <input
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="e.g. Sarra"
                  className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-accent"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-stone-700">Type</span>
                <input
                  value={form.type}
                  onChange={(e) => update("type", e.target.value)}
                  placeholder="e.g. HR assistant"
                  className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-accent"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-stone-700">Role title</span>
                <input
                  value={form.roleTitle}
                  onChange={(e) => update("roleTitle", e.target.value)}
                  placeholder="e.g. Senior HR Advisor"
                  className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-accent"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-stone-700">Department</span>
                <input
                  value={form.department}
                  onChange={(e) => update("department", e.target.value)}
                  placeholder="e.g. People & Culture"
                  className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-accent"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-stone-700">Prompt</span>
              <textarea
                value={form.prompt}
                onChange={(e) => update("prompt", e.target.value)}
                rows={5}
                placeholder="You are ... Answer employee questions about ... with a ... tone."
                className="w-full resize-none rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-accent"
              />
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-stone-700">Q&amp;A model</span>
                <select
                  value={form.qnaModel}
                  onChange={(e) => update("qnaModel", e.target.value as QnaModel)}
                  className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-accent"
                >
                  {QNA_MODELS.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <span className="mb-1.5 flex items-center justify-between text-sm font-medium text-stone-700">
                  Creativity <span className="text-stone-400">{form.creativity}%</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={form.creativity}
                  onChange={(e) => update("creativity", Number(e.target.value))}
                  className="mt-3.5 w-full accent-accent"
                />
              </div>
            </div>

            {/* Status/version only make sense once a persona actually exists —
                a brand-new one is always created as Draft v1.0 server-side. */}
            {!isNew ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-stone-700">Status</span>
                  <select
                    value={form.status}
                    onChange={(e) => update("status", e.target.value as PublishState)}
                    className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-accent"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-stone-700">Version</span>
                  <input
                    value={form.version}
                    onChange={(e) => update("version", e.target.value)}
                    className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-accent"
                  />
                </label>
              </div>
            ) : null}
          </div>
        </AdminCard>

        {saveError ? (
          <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{saveError}</p>
        ) : null}

        <div className="mt-6 flex items-center justify-between">
          <AdminSecondaryButton onClick={() => router.push("/admin/personas")}>Cancel</AdminSecondaryButton>
          <AdminPrimaryButton onClick={handleSave} disabled={saving}>
            {saving ? (isNew ? "Creating…" : "Saving…") : isNew ? "Create persona" : "Save changes"}
          </AdminPrimaryButton>
        </div>
      </div>
    </>
  );
}
