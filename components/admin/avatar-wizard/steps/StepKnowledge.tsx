"use client";

import { useEffect, useRef, useState } from "react";
import { Check, File as FileIcon, Upload, X } from "lucide-react";
import { AdminCard } from "@/components/admin/AdminCard";
import { Table, THead, Th, Tr, Td, StatusBadge } from "@/components/admin/table/Table";
import { ActionsMenu } from "@/components/admin/table/ActionsMenu";
import { knowledgeTone } from "@/lib/admin/mock-data";
import type { KnowledgeSource } from "@/lib/admin/types";
import type { WizardData, WizardKnowledgeFile } from "../wizard-types";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function filesToWizardFiles(fileList: FileList): WizardKnowledgeFile[] {
  return Array.from(fileList).map((file) => ({
    id: `${file.name}-${file.size}-${file.lastModified}`,
    name: file.name,
    sizeLabel: formatBytes(file.size),
  }));
}

export function StepKnowledge({
  data,
  onChange,
}: {
  data: WizardData["knowledge"];
  onChange: (next: WizardData["knowledge"]) => void;
}) {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/knowledge")
      .then((res) => res.json())
      .then((rows: KnowledgeSource[]) => {
        if (!cancelled) setKnowledgeSources(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleExisting(id: string) {
    const selectedIds = data.selectedIds.includes(id)
      ? data.selectedIds.filter((s) => s !== id)
      : [...data.selectedIds, id];
    onChange({ ...data, selectedIds });
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const incoming = filesToWizardFiles(fileList);
    const existingIds = new Set(data.newSource.files.map((f) => f.id));
    const merged = [...data.newSource.files, ...incoming.filter((f) => !existingIds.has(f.id))];
    onChange({ ...data, newSource: { ...data.newSource, files: merged } });
  }

  function removeFile(id: string) {
    onChange({ ...data, newSource: { ...data.newSource, files: data.newSource.files.filter((f) => f.id !== id) } });
  }

  return (
    <AdminCard>
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange({ ...data, mode: "existing" })}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            data.mode === "existing" ? "bg-stone-900 text-white" : "border border-stone-200 text-stone-600"
          }`}
        >
          Use existing knowledge
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...data, mode: "new" })}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            data.mode === "new" ? "bg-stone-900 text-white" : "border border-stone-200 text-stone-600"
          }`}
        >
          Create a new knowledge source
        </button>
      </div>

      {data.mode === "existing" ? (
        <>
          <p className="mb-4 text-sm text-stone-500">Choose which sources this avatar can pull answers from.</p>
          {loading ? (
            <p className="text-sm text-stone-500">Loading knowledge sources…</p>
          ) : knowledgeSources.length === 0 ? (
            <p className="text-sm text-stone-500">No knowledge sources yet — create a new one instead.</p>
          ) : (
            <Table>
              <THead>
                <tr>
                  <Th>Select</Th>
                  <Th>Name</Th>
                  <Th>File count</Th>
                  <Th>Status</Th>
                  <Th className="min-w-[220px]">Description</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </THead>
              <tbody>
                {knowledgeSources.map((source) => {
                  const selected = data.selectedIds.includes(source.id);
                  return (
                    <Tr key={source.id} className={selected ? "bg-accent/5" : ""}>
                      <Td>
                        <button
                          type="button"
                          onClick={() => toggleExisting(source.id)}
                          aria-label={`${selected ? "Remove" : "Add"} ${source.name}`}
                          aria-pressed={selected}
                          className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition-colors ${
                            selected ? "border-accent bg-accent text-white" : "border-stone-300"
                          }`}
                        >
                          {selected ? <Check className="h-3 w-3" /> : null}
                        </button>
                      </Td>
                      <Td className="font-medium text-stone-900">{source.name}</Td>
                      <Td>{source.fileCount}</Td>
                      <Td>
                        <StatusBadge label={source.status} tone={knowledgeTone(source.status)} />
                      </Td>
                      <Td className="text-stone-500">{source.description}</Td>
                      <Td className="text-right">
                        <ActionsMenu name={source.name} variant="knowledge" />
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-stone-700">Source name</span>
              <input
                value={data.newSource.name}
                onChange={(e) => onChange({ ...data, newSource: { ...data.newSource, name: e.target.value } })}
                placeholder="e.g. Onboarding guides"
                className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-accent"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-stone-700">File count</span>
              <div className="flex h-[46px] items-center rounded-2xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-500">
                {data.newSource.files.length} file{data.newSource.files.length === 1 ? "" : "s"}
              </div>
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-stone-700">Description</span>
            <textarea
              value={data.newSource.description}
              onChange={(e) => onChange({ ...data, newSource: { ...data.newSource, description: e.target.value } })}
              rows={3}
              placeholder="What does this source cover?"
              className="w-full resize-none rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-accent"
            />
          </label>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-stone-700">Files</span>
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
                addFiles(e.dataTransfer.files);
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
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>

            {data.newSource.files.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-1.5">
                {data.newSource.files.map((file) => (
                  <li
                    key={file.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-stone-100 bg-stone-50/60 px-3 py-2 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2 text-stone-700">
                      <FileIcon className="h-4 w-4 shrink-0 text-stone-400" />
                      <span className="truncate">{file.name}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="text-xs text-stone-400">{file.sizeLabel}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(file.id)}
                        aria-label={`Remove ${file.name}`}
                        className="flex h-6 w-6 items-center justify-center rounded-full text-stone-400 hover:bg-stone-200 hover:text-stone-700"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="border-t border-stone-100 pt-6">
            <p className="mb-3 text-sm font-medium text-stone-700">Preview</p>
            <Table>
              <THead>
                <tr>
                  <Th>Name</Th>
                  <Th>File count</Th>
                  <Th>Status</Th>
                  <Th className="min-w-[220px]">Description</Th>
                </tr>
              </THead>
              <tbody>
                <Tr>
                  <Td className="font-medium text-stone-900">{data.newSource.name || "Untitled source"}</Td>
                  <Td>{data.newSource.files.length}</Td>
                  <Td>
                    <StatusBadge label="Processing" tone={knowledgeTone("Processing")} />
                  </Td>
                  <Td className="text-stone-500">{data.newSource.description || "—"}</Td>
                </Tr>
              </tbody>
            </Table>
          </div>
        </div>
      )}
    </AdminCard>
  );
}
