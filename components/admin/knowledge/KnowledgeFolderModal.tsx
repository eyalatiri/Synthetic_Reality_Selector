"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Upload, Pencil, X } from "lucide-react";
import { AdminSecondaryButton } from "@/components/admin/AdminPageHeader";
import { StatusBadge } from "@/components/admin/table/Table";
import { knowledgeTone } from "@/lib/admin/mock-data";
import type { KnowledgeSource, KnowledgeFile } from "@/lib/admin/types";
import { FolderGlyph, folderToneClass, fileVisual, formatBytes } from "./knowledge-visuals";

/**
 * Quick-look popup for a knowledge folder: a friendly grid of the files it
 * contains (icon + name + size, not a bare list), with drag-and-drop / a
 * button to add more and a hover-to-remove control on each tile.
 *
 * `source` is the currently-open KnowledgeSource, or null when closed — the
 * page passes its live copy from the `sources` list so the header (status,
 * file count) stays correct after edits, instead of a stale snapshot from
 * the moment the card was clicked.
 *
 * Renaming, changing status, or editing the description still happens on
 * the existing full-page editor (linked via "Edit details") — this popup is
 * deliberately just the fast, visual way to see and manage what's inside.
 */
export function KnowledgeFolderModal({
  source,
  onClose,
  onChanged,
}: {
  source: KnowledgeSource | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [busyFileId, setBusyFileId] = useState<string | null>(null);
  const [uploadingCount, setUploadingCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sourceId = source?.id ?? null;

  function load(id: string) {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/knowledge/${id}/files`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load files");
        return res.json();
      })
      .then((rows: KnowledgeFile[]) => setFiles(rows))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load files"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!sourceId) return;
    load(sourceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId]);

  useEffect(() => {
    if (!sourceId) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [sourceId, onClose]);

  if (!source) return null;

  // Uploads each selected file as a real multipart/form-data request — the
  // API route reads it with req.formData() and expects a `file` field
  // containing actual bytes, not a JSON description of the file. Do NOT set
  // a Content-Type header here: the browser has to generate it itself so it
  // includes the multipart boundary, which is what req.formData() needs.
  async function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !source) return;
    const filesToUpload = Array.from(fileList);
    setUploadingCount((n) => n + filesToUpload.length);

    for (const file of filesToUpload) {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(`/api/admin/knowledge/${source.id}/files`, {
          method: "POST",
          body: formData, // no headers — let the browser set Content-Type + boundary
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `Failed to upload "${file.name}"`);
        }
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to upload file");
      } finally {
        setUploadingCount((n) => n - 1);
      }
    }
    load(source.id);
    onChanged();
  }

  async function removeFile(fileId: string) {
    if (!source) return;
    setBusyFileId(fileId);
    try {
      const res = await fetch(`/api/admin/knowledge/${source.id}/files/${fileId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to remove file");
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove file");
    } finally {
      setBusyFileId(null);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${source.name} folder`}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-stone-100 px-6 py-5">
          <div className="flex items-start gap-4">
            <FolderGlyph toneClass={folderToneClass(source.status)} className="h-11 w-14 shrink-0" />
            <div className="min-w-0">
              <h2 className="truncate text-xl font-semibold text-stone-900">{source.name}</h2>
              <p className="mt-1 max-w-md text-sm text-stone-500">{source.description || "No description yet."}</p>
              <div className="mt-2 flex items-center gap-2">
                <StatusBadge label={source.status} tone={knowledgeTone(source.status)} />
                <span className="text-xs text-stone-400">
                  {files.length} file{files.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body — the files, as a friendly icon grid rather than a list */}
        <div
          className={`flex-1 overflow-y-auto px-6 py-5 transition-colors ${dragActive ? "bg-accent/5" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            void addFiles(e.dataTransfer.files);
          }}
        >
          {error ? (
            <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
          ) : loading ? (
            <p className="text-sm text-stone-500">Loading files…</p>
          ) : files.length === 0 && uploadingCount === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-stone-300 px-6 py-12 text-center">
              <Upload className="h-6 w-6 text-stone-400" />
              <p className="text-sm text-stone-600">This folder is empty.</p>
              <p className="text-xs text-stone-400">Drag files in here, or use "Add files" below.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {files.map((file) => {
                const { Icon, toneClass } = fileVisual(file.name);
                return (
                  <div
                    key={file.id}
                    className="group relative flex flex-col items-center gap-2 rounded-2xl border border-stone-100 bg-stone-50/60 px-3 py-4 text-center"
                  >
                    <button
                      type="button"
                      onClick={() => removeFile(file.id)}
                      disabled={busyFileId === file.id}
                      aria-label={`Remove ${file.name}`}
                      className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-stone-400 opacity-0 shadow-sm transition-opacity hover:text-red-600 group-hover:opacity-100 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <Icon className={`h-8 w-8 ${toneClass}`} strokeWidth={1.5} />
                    <span className="line-clamp-2 w-full break-words text-xs font-medium text-stone-700">
                      {file.name}
                    </span>
                    <span className="text-[11px] text-stone-400">{formatBytes(file.sizeBytes)}</span>
                  </div>
                );
              })}
              {uploadingCount > 0 &&
                Array.from({ length: uploadingCount }).map((_, i) => (
                  <div
                    key={`uploading-${i}`}
                    className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-stone-200 bg-stone-50/40 px-3 py-4 text-center"
                  >
                    <Upload className="h-8 w-8 animate-pulse text-stone-300" strokeWidth={1.5} />
                    <span className="text-xs text-stone-400">Uploading…</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-4 border-t border-stone-100 px-6 py-4">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.txt,.csv,.md"
            className="hidden"
            onChange={(e) => {
              void addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-full border border-dashed border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:border-accent hover:text-accent"
          >
            <Upload className="h-4 w-4" /> Add files
          </button>

          <Link href={`/admin/knowledge/${source.id}`} onClick={onClose}>
            <AdminSecondaryButton>
              <span className="flex items-center gap-2">
                <Pencil className="h-3.5 w-3.5" /> Edit details
              </span>
            </AdminSecondaryButton>
          </Link>
        </div>
      </div>
    </div>,
    document.body
  );
}
