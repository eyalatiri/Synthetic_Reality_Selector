"use client";

import { useRef, useState } from "react";
import { Video, CheckCircle2, Loader2, X } from "lucide-react";
import { validateAvatarVideo } from "@/lib/avatar/validateVideo";

// Reusable video picker for the plain Add/Edit avatar pages. Calls the same
// /api/admin/avatars/create-video route the wizard uses (validate -> upload
// to Supabase Storage, no AI at this stage) and hands back the public URL.
export function AvatarVideoUpload({
  value,
  onChange,
  onProcessingChange,
}: {
  value: string | null;
  onChange: (videoUrl: string | null) => void;
  onProcessingChange?: (processing: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSelected(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setError(null);

    const problem = await validateAvatarVideo(file);
    if (problem) {
      setError(problem);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setUploading(true);
    onProcessingChange?.(true);

    try {
      const form = new FormData();
      form.append("source_video", file, file.name);

      const res = await fetch("/api/admin/avatars/create-video", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to process avatar video");

      onChange(body.videoUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process avatar video");
    } finally {
      setUploading(false);
      onProcessingChange?.(false);
      if (inputRef.current) inputRef.current.value = ""; // allow re-selecting the same file
    }
  }

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-stone-700">Avatar video (optional)</span>
      <p className="mb-2 text-xs text-stone-500">
        A short (3–20 s) front-facing clip of the person. It loops while the avatar is idle, and MuseTalk
        lip-syncs every spoken reply onto it during conversations.
      </p>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-stone-50 text-stone-400 hover:border-accent hover:text-accent disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : value ? (
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          ) : (
            <Video className="h-5 w-5" />
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={(e) => handleSelected(e.target.files?.[0])}
        />

        <div className="flex-1 text-xs text-stone-500">
          {uploading ? (
            <span>Uploading “{fileName}”…</span>
          ) : value ? (
            <span className="text-emerald-600">
              {fileName ? `“${fileName}” uploaded and ready.` : "Video attached."}
            </span>
          ) : (
            <span>MP4 or WebM.</span>
          )}
        </div>

        {value && !uploading ? (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setFileName(null);
            }}
            className="flex items-center gap-1 rounded-full border border-stone-200 px-3 py-1.5 text-xs text-stone-600 hover:border-stone-300"
          >
            <X className="h-3 w-3" /> Remove
          </button>
        ) : null}
      </div>

      {value ? (
        <video src={value} controls muted playsInline className="mt-3 h-40 rounded-2xl bg-black" />
      ) : null}

      {error ? (
        <p className="mt-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
      ) : null}
    </div>
  );
}