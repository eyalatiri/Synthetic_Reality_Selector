"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Upload, Video, CheckCircle2, Loader2 } from "lucide-react";
import { AdminCard, AdminLivePanel } from "@/components/admin/AdminCard";
import { StatusBadge, Table, THead, Th, Tr, Td } from "@/components/admin/table/Table";
import { ActionsMenu } from "@/components/admin/table/ActionsMenu";
import { OWNER_TYPES, BODY_TYPES, publishTone } from "@/lib/admin/mock-data";
import type { Avatar } from "@/lib/admin/types";
import { validateAvatarVideo } from "@/lib/avatar/validateVideo";
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
  onVideoProcessingChange,
}: {
  data: WizardData["avatar"];
  onChange: (next: WizardData["avatar"]) => void;
  // Reports upload state up to AvatarWizard so it can disable "Publish
  // avatar" until the video has finished uploading — see AvatarWizard.tsx's
  // videoProcessing state.
  onVideoProcessingChange?: (processing: boolean) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // ---- Existing-avatar picker (mirrors StepPersona.tsx / StepKnowledge.tsx) ----
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [loadingAvatars, setLoadingAvatars] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/avatars")
      .then((res) => res.json())
      .then((rows: Avatar[]) => {
        if (!cancelled) setAvatars(rows);
      })
      .finally(() => {
        if (!cancelled) setLoadingAvatars(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Separate from the JSON-based wizard state further down: uploading the
  // source video is its own round trip (see /api/admin/avatars/create-video),
  // not part of the final "Publish avatar" JSON payload — a raw File can't
  // travel inside JSON.stringify(data) the way AvatarWizard.tsx sends the
  // rest of the wizard's state. No AI runs here: MuseTalk only lip-syncs
  // replies during a conversation.
  const [videoFileName, setVideoFileName] = useState<string | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  function handleFileSelected(file: File | undefined) {
    if (!file) return;
    if (data.imagePreviewUrl) URL.revokeObjectURL(data.imagePreviewUrl);
    onChange({ ...data, imagePreviewUrl: URL.createObjectURL(file) });
  }

  async function handleVideoSelected(file: File | undefined) {
    if (!file) return;
    setVideoFileName(file.name);
    setVideoError(null);

    // Cheap client-side checks (type, size, 3-20 s, playable in this
    // browser) before sending anything — every reply is lip-synced against
    // this clip, so a bad one hurts every conversation.
    const problem = await validateAvatarVideo(file);
    if (problem) {
      setVideoError(problem);
      return;
    }

    setVideoUploading(true);
    onVideoProcessingChange?.(true);
    // Clear any previous result immediately so a re-upload can't leave a
    // stale videoUrl sitting around if this new attempt fails.
    onChange({ ...data, videoUrl: null });

    try {
      const form = new FormData();
      form.append("source_video", file, file.name);

      const res = await fetch("/api/admin/avatars/create-video", {
        method: "POST",
        body: form,
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to process avatar video");

      onChange({ ...data, videoUrl: body.videoUrl });
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : "Failed to process avatar video");
    } finally {
      setVideoUploading(false);
      onVideoProcessingChange?.(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminCard>
        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange({ ...data, mode: "existing" })}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              data.mode === "existing" ? "bg-stone-900 text-white" : "border border-stone-200 text-stone-600"
            }`}
          >
            Use an existing avatar
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...data, mode: "new" })}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              data.mode === "new" ? "bg-stone-900 text-white" : "border border-stone-200 text-stone-600"
            }`}
          >
            Create a new avatar
          </button>
        </div>

        {data.mode === "existing" ? (
          loadingAvatars ? (
            <p className="text-sm text-stone-500">Loading avatars…</p>
          ) : avatars.length === 0 ? (
            <p className="text-sm text-stone-500">No avatars yet — create a new one instead.</p>
          ) : (
            <>
              <p className="mb-4 text-sm text-stone-500">Pick the avatar this agent should use.</p>
              <Table>
                <THead>
                  <tr>
                    <Th>Select</Th>
                    <Th>Avatar</Th>
                    <Th>Owner</Th>
                    <Th>Owner type</Th>
                    <Th>Body type</Th>
                    <Th>Video</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </THead>
                <tbody>
                  {avatars.map((avatar) => {
                    const selected = data.existingAvatarId === avatar.id;
                    return (
                      <Tr key={avatar.id} className={selected ? "bg-accent/5" : ""}>
                        <Td>
                          <button
                            type="button"
                            onClick={() =>
                              onChange({
                                ...data,
                                existingAvatarId: avatar.id,
                                // Also mirror the chosen avatar's own fields onto the
                                // shared draft — StepTest.tsx's greeting reads
                                // data.avatar.name directly, so without this an
                                // existing-mode selection would still show "Your
                                // avatar" in the live test step.
                                name: avatar.name,
                                owner: avatar.owner,
                                ownerType: avatar.ownerType,
                                bodyType: avatar.bodyType,
                                imagePreviewUrl: avatar.imageUrl,
                                videoUrl: avatar.videoUrl,
                                status: avatar.status,
                              })
                            }
                            aria-label={`Select ${avatar.name}`}
                            aria-pressed={selected}
                            className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
                              selected ? "border-accent bg-accent text-white" : "border-stone-300"
                            }`}
                          >
                            {selected ? <Check className="h-3 w-3" /> : null}
                          </button>
                        </Td>
                        <Td className="font-medium text-stone-900">
                          <span className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent/10 font-serif text-sm font-semibold text-accent">
                              {avatar.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={avatar.imageUrl} alt="" className="h-full w-full object-cover" />
                              ) : (
                                avatar.name[0]?.toUpperCase()
                              )}
                            </span>
                            {avatar.name}
                          </span>
                        </Td>
                        <Td>{avatar.owner}</Td>
                        <Td>{avatar.ownerType}</Td>
                        <Td>{avatar.bodyType}</Td>
                        <Td>{avatar.videoUrl ? "Yes" : "—"}</Td>
                        <Td>
                          <StatusBadge label={avatar.status} tone={publishTone(avatar.status)} />
                        </Td>
                        <Td className="text-right">
                          <ActionsMenu variant="avatar" avatar={avatar} onChanged={() => {}} />
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            </>
          )
        ) : null}
      </AdminCard>

      {data.mode === "new" ? (
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

            <div>
              <span className="mb-2 block text-sm font-medium text-stone-700">Avatar video</span>
              <p className="mb-2 text-xs text-stone-500">
                A short front-facing clip (3–20 s, MP4/WebM, H.264). It plays on a loop while the avatar is
                idle, and every spoken reply is lip-synced onto it by MuseTalk during the conversation.
                Keep the head still, the face visible and the mouth relaxed or closed.
              </p>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  disabled={videoUploading}
                  className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-stone-300 bg-stone-50 text-stone-400 hover:border-accent hover:text-accent disabled:opacity-60"
                >
                  {videoUploading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : data.videoUrl ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                  ) : (
                    <Video className="h-5 w-5" />
                  )}
                </button>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  className="hidden"
                  onChange={(e) => handleVideoSelected(e.target.files?.[0])}
                />
                <div className="text-xs text-stone-500">
                  {videoUploading ? (
                    <span>Uploading "{videoFileName}"…</span>
                  ) : data.videoUrl ? (
                    <span className="text-emerald-600">"{videoFileName ?? "Video"}" uploaded and ready.</span>
                  ) : (
                    <span>MP4 or WebM, a clear front-facing clip works best.</span>
                  )}
                </div>
              </div>
              {videoError ? (
                <p className="mt-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">
                  {videoError}
                </p>
              ) : null}
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
      ) : null}
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
