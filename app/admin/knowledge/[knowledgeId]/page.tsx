"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { File as FileIcon, Link as LinkIcon, Upload, X } from "lucide-react";
import { AdminPageHeader, AdminPrimaryButton, AdminSecondaryButton } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import type { KnowledgeSource, KnowledgeFile, KnowledgeStatus } from "@/lib/admin/types";

// Replaces what would otherwise be four near-identical pages
// (knowledge/new, knowledge/[id]/edit, and their persona equivalents) down
// to one dynamic route per resource. `knowledgeId` is either a real source
// UUID (edit mode) or the literal "new" (create mode) — matches the existing
// /admin/knowledge/new link, so nothing else needs to change.
const STATUSES: KnowledgeStatus[] = ["Processing", "Indexed", "Error"];

// In create mode nothing can be persisted yet — there's no source row for
// it to belong to — so pending items stay client-side until the source is
// saved. In edit mode the source already exists, so add/remove hit the API
// immediately. Same UI, two different backing stores.
//
// A pending item is either a real File (uploaded) or a URL string (fetched
// server-side on save) — same list, different payload shape and different
// API route each hits once the source exists.
type PendingItem = { id: string; kind: "file"; file: File } | { id: string; kind: "url"; url: string };

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export default function KnowledgeSourceFormPage() {
  const router = useRouter();
  const params = useParams<{ knowledgeId: string }>();
  const isNew = params.knowledgeId === "new";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<KnowledgeStatus>("Processing");

  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]); // create mode only
  const [savedFiles, setSavedFiles] = useState<KnowledgeFile[]>([]); // edit mode only
  const [dragActive, setDragActive] = useState(false);

  const [urlInput, setUrlInput] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [addingUrl, setAddingUrl] = useState(false);

  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function loadSavedFiles() {
    fetch(`/api/admin/knowledge/${params.knowledgeId}/files`)
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: KnowledgeFile[]) => setSavedFiles(rows))
      .catch(() => {});
  }

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    fetch(`/api/admin/knowledge/${params.knowledgeId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load knowledge source");
        return res.json();
      })
      .then((data: KnowledgeSource) => {
        if (cancelled) return;
        setName(data.name);
        setDescription(data.description);
        setStatus(data.status);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load knowledge source");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    loadSavedFiles();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, params.knowledgeId]);

  function addPendingFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const incoming: PendingItem[] = Array.from(fileList).map((f) => ({
      id: `file-${f.name}-${f.size}-${f.lastModified}`,
      kind: "file",
      file: f,
    }));
    setPendingItems((prev) => {
      const existingIds = new Set(prev.map((item) => item.id));
      return [...prev, ...incoming.filter((item) => !existingIds.has(item.id))];
    });
  }

  async function addSavedFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    for (const file of Array.from(fileList)) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        // NOTE: no explicit Content-Type header — the browser sets
        // "multipart/form-data; boundary=..." itself from the FormData body.
        // Setting it manually strips the boundary and breaks req.formData()
        // on the server.
        const res = await fetch(`/api/admin/knowledge/${params.knowledgeId}/files`, {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw new Error((await res.json()).error ?? `Failed to add "${file.name}"`);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to add file");
      }
    }
    loadSavedFiles();
  }

  function addPendingUrl() {
    const url = urlInput.trim();
    if (!url) return;
    if (!isValidHttpUrl(url)) {
      setUrlError("Enter a valid http(s) URL.");
      return;
    }
    setUrlError(null);
    setPendingItems((prev) => {
      if (prev.some((item) => item.kind === "url" && item.url === url)) return prev; // no duplicates
      return [...prev, { id: `url-${url}`, kind: "url", url }];
    });
    setUrlInput("");
  }

  async function addSavedUrl() {
    const url = urlInput.trim();
    if (!url) return;
    if (!isValidHttpUrl(url)) {
      setUrlError("Enter a valid http(s) URL.");
      return;
    }
    setUrlError(null);
    setAddingUrl(true);
    try {
      const res = await fetch(`/api/admin/knowledge/${params.knowledgeId}/urls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `Failed to add "${url}"`);
      setUrlInput("");
      loadSavedFiles();
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : "Failed to add URL");
    } finally {
      setAddingUrl(false);
    }
  }

  async function removeSavedFile(fileId: string) {
    try {
      const res = await fetch(`/api/admin/knowledge/${params.knowledgeId}/files/${fileId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to remove file");
      loadSavedFiles();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove file");
    }
  }

  function handleFilesPicked(fileList: FileList | null) {
    if (isNew) addPendingFiles(fileList);
    else void addSavedFiles(fileList);
  }

  function handleUrlSubmit() {
    if (isNew) addPendingUrl();
    else void addSavedUrl();
  }

  async function handleSave() {
    if (!name.trim()) {
      setSaveError("Name is required.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      if (isNew) {
        const sourceRes = await fetch("/api/admin/knowledge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description, status: "Processing" }),
        });
        if (!sourceRes.ok) throw new Error((await sourceRes.json()).error ?? "Failed to create knowledge source");
        const source = await sourceRes.json();

        for (const item of pendingItems) {
          if (item.kind === "file") {
            const formData = new FormData();
            formData.append("file", item.file);
            const fileRes = await fetch(`/api/admin/knowledge/${source.id}/files`, {
              method: "POST",
              body: formData,
            });
            if (!fileRes.ok) {
              throw new Error((await fileRes.json()).error ?? `Failed to upload file "${item.file.name}"`);
            }
          } else {
            const urlRes = await fetch(`/api/admin/knowledge/${source.id}/urls`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url: item.url }),
            });
            if (!urlRes.ok) {
              throw new Error((await urlRes.json()).error ?? `Failed to add URL "${item.url}"`);
            }
          }
        }
      } else {
        const res = await fetch(`/api/admin/knowledge/${params.knowledgeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description, status }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed to save knowledge source");
      }
      router.push("/admin/knowledge");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : `Failed to ${isNew ? "create" : "save"} knowledge source`);
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <>
        <AdminPageHeader title="Edit knowledge source" />
        <p className="mt-8 text-sm text-stone-500">Loading…</p>
      </>
    );
  }

  if (loadError) {
    return (
      <>
        <AdminPageHeader title="Edit knowledge source" />
        <p className="mt-8 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{loadError}</p>
      </>
    );
  }

  const fileCount = isNew ? pendingItems.length : savedFiles.length;

  return (
    <>
      <AdminPageHeader
        title={isNew ? "Add knowledge source" : `Edit ${name}`}
        subtitle={
          isNew ? "Register a new source your avatars can pull answers from." : "Update this source's details and files."
        }
      />

      <div className="mt-8 max-w-2xl">
        <AdminCard>
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-stone-700">Source name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Onboarding guides"
                  className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-accent"
                />
              </label>
              {isNew ? (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-stone-700">Item count</span>
                  <div className="flex h-[46px] items-center rounded-2xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-500">
                    {fileCount} item{fileCount === 1 ? "" : "s"}
                  </div>
                </label>
              ) : (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-stone-700">Status</span>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as KnowledgeStatus)}
                    className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-accent"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-stone-700">Description</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="What does this source cover?"
                className="w-full resize-none rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-accent"
              />
            </label>

            <div>
              <span className="mb-1.5 block text-sm font-medium text-stone-700">Files & links ({fileCount})</span>

              {isNew
                ? pendingItems.length > 0 && (
                    <ul className="mb-3 flex flex-col gap-1.5">
                      {pendingItems.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-stone-100 bg-stone-50/60 px-3 py-2 text-sm"
                        >
                          <span className="flex min-w-0 items-center gap-2 text-stone-700">
                            {item.kind === "file" ? (
                              <FileIcon className="h-4 w-4 shrink-0 text-stone-400" />
                            ) : (
                              <LinkIcon className="h-4 w-4 shrink-0 text-stone-400" />
                            )}
                            <span className="truncate">{item.kind === "file" ? item.file.name : item.url}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-3">
                            {item.kind === "file" ? (
                              <span className="text-xs text-stone-400">{formatBytes(item.file.size)}</span>
                            ) : (
                              <span className="text-xs text-stone-400">Link</span>
                            )}
                            <button
                              type="button"
                              onClick={() => setPendingItems((prev) => prev.filter((i) => i.id !== item.id))}
                              aria-label={`Remove ${item.kind === "file" ? item.file.name : item.url}`}
                              className="flex h-6 w-6 items-center justify-center rounded-full text-stone-400 hover:bg-stone-200 hover:text-stone-700"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )
                : savedFiles.length > 0 && (
                    <ul className="mb-3 flex flex-col gap-1.5">
                      {savedFiles.map((file) => (
                        <li
                          key={file.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-stone-100 bg-stone-50/60 px-3 py-2 text-sm"
                        >
                          <span className="flex min-w-0 items-center gap-2 text-stone-700">
                            {file.sourceUrl ? (
                              <LinkIcon className="h-4 w-4 shrink-0 text-stone-400" />
                            ) : (
                              <FileIcon className="h-4 w-4 shrink-0 text-stone-400" />
                            )}
                            {file.sourceUrl ? (
                              <a
                                href={file.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="truncate text-accent hover:underline"
                                title={file.sourceUrl}
                              >
                                {file.name}
                              </a>
                            ) : (
                              <span className="truncate">{file.name}</span>
                            )}
                          </span>
                          <span className="flex shrink-0 items-center gap-3">
                            <span className="text-xs text-stone-400">{formatBytes(file.sizeBytes)}</span>
                            <button
                              type="button"
                              onClick={() => removeSavedFile(file.id)}
                              aria-label={`Remove ${file.name}`}
                              className="flex h-6 w-6 items-center justify-center rounded-full text-stone-400 hover:bg-stone-200 hover:text-stone-700"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  handleFilesPicked(e.dataTransfer.files);
                }}
                className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
                  dragActive ? "border-accent bg-accent/5" : "border-stone-300 hover:border-stone-400"
                }`}
              >
                <Upload className="h-6 w-6 text-stone-400" />
                <p className="text-sm text-stone-600">
                  <span className="font-medium text-accent">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-stone-400">PDF, DOCX, TXT, CSV — up to 20 files</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.csv,.md"
                  className="hidden"
                  onChange={(e) => {
                    handleFilesPicked(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>

              <div className="mt-3">
                <span className="mb-1.5 block text-xs font-medium text-stone-500">Or add a web page by URL</span>
                <div className="flex items-center gap-2">
                  <input
                    value={urlInput}
                    onChange={(e) => {
                      setUrlInput(e.target.value);
                      if (urlError) setUrlError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleUrlSubmit();
                      }
                    }}
                    placeholder="https://example.com/policy-page"
                    className="w-full rounded-2xl border border-stone-200 px-4 py-2.5 text-sm outline-none focus:border-accent"
                  />
                  <AdminSecondaryButton onClick={handleUrlSubmit} disabled={addingUrl}>
                    {addingUrl ? "Adding…" : "Add link"}
                  </AdminSecondaryButton>
                </div>
                {urlError ? <p className="mt-1.5 text-xs text-red-600">{urlError}</p> : null}
                <p className="mt-1.5 text-xs text-stone-400">
                  We fetch the page and extract its main article content — not the full page markup.
                </p>
              </div>
            </div>
          </div>
        </AdminCard>

        {saveError ? (
          <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{saveError}</p>
        ) : null}

        <div className="mt-6 flex items-center justify-between">
          <AdminSecondaryButton onClick={() => router.push("/admin/knowledge")}>Cancel</AdminSecondaryButton>
          <AdminPrimaryButton onClick={handleSave} disabled={saving}>
            {saving ? (isNew ? "Creating…" : "Saving…") : isNew ? "Create source" : "Save changes"}
          </AdminPrimaryButton>
        </div>
      </div>
    </>
  );
}
