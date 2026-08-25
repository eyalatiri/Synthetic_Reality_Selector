"use client";

import { useRef } from "react";
import { Upload } from "lucide-react";
import { AdminCard, AdminLivePanel } from "@/components/admin/AdminCard";
import { StatusBadge } from "@/components/admin/table/Table";
import { OWNER_TYPES, BODY_TYPES } from "@/lib/admin/mock-data";
import type { WizardData } from "../wizard-types";

const ownerTypeOptions: { id: WizardData["avatar"]["ownerType"]; label: string }[] = OWNER_TYPES.map((id) => ({
  id,
  label: id,
}));

const bodyTypeOptions: { id: WizardData["avatar"]["bodyType"]; label: string }[] = BODY_TYPES.map((id) => ({
  id,
  label: id,
}));

export function StepAvatar({
  data,
  onChange,
}: {
  data: WizardData["avatar"];
  onChange: (next: WizardData["avatar"]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelected(file: File | undefined) {
    if (!file) return;
    if (data.imagePreviewUrl) URL.revokeObjectURL(data.imagePreviewUrl);
    onChange({ ...data, imagePreviewUrl: URL.createObjectURL(file) });
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
      <AdminCard className="flex flex-col gap-5">
        <div>
          <h2 className="font-semibold text-stone-900">Basics</h2>
          <p className="text-sm text-stone-500">Image, name, and ownership for this avatar.</p>
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium text-stone-700">Image</span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-stone-300 bg-stone-50 text-stone-400 hover:border-accent hover:text-accent"
            >
              {data.imagePreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.imagePreviewUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <Upload className="h-5 w-5" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileSelected(e.target.files?.[0])}
            />
            <p className="text-xs text-stone-500">PNG or JPG, at least 512×512px.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-stone-700">Avatar name</span>
            <input
              value={data.name}
              onChange={(e) => onChange({ ...data, name: e.target.value })}
              placeholder="e.g. Aura"
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-stone-700">Owner</span>
            <input
              value={data.owner}
              onChange={(e) => onChange({ ...data, owner: e.target.value })}
              placeholder="e.g. Eya Ben Salem"
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-accent"
            />
          </label>
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium text-stone-700">Owner type</span>
          <div className="flex flex-wrap gap-2">
            {ownerTypeOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChange({ ...data, ownerType: opt.id })}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  data.ownerType === opt.id
                    ? "bg-stone-900 text-white"
                    : "border border-stone-200 text-stone-600 hover:border-stone-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium text-stone-700">Body type</span>
          <div className="flex flex-wrap gap-2">
            {bodyTypeOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChange({ ...data, bodyType: opt.id })}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  data.bodyType === opt.id
                    ? "bg-stone-900 text-white"
                    : "border border-stone-200 text-stone-600 hover:border-stone-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </AdminCard>

      <div className="xl:sticky xl:top-10 xl:self-start">
        <AdminLivePanel>
          <p className="text-xs font-semibold uppercase tracking-wide text-white/40">Live preview</p>
          <div className="mt-4 flex h-32 items-center justify-center overflow-hidden rounded-2xl bg-white/5">
            {data.imagePreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.imagePreviewUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/20 font-serif text-2xl font-semibold text-accent">
                {data.name ? data.name[0].toUpperCase() : "?"}
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-col gap-2 text-sm">
            <Row label="Name" value={data.name || "Untitled avatar"} />
            <Row label="Owner" value={data.owner || "Not set"} />
            <Row label="Owner type" value={ownerTypeOptions.find((o) => o.id === data.ownerType)?.label ?? ""} />
            <Row label="Body type" value={bodyTypeOptions.find((b) => b.id === data.bodyType)?.label ?? ""} />
          </div>
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3 text-sm">
            <span className="text-white/60">Status</span>
            <StatusBadge label={data.status} tone={data.status === "Private" ? "neutral" : "success"} />
          </div>
        </AdminLivePanel>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 pb-2">
      <span className="text-white/40">{label}</span>
      <span className="font-medium text-white">{value}</span>
    </div>
  );
}
