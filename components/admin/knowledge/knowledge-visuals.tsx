import type { LucideIcon } from "lucide-react";
import { FileText, FileSpreadsheet, FileImage, FileCode2, File as FileIcon } from "lucide-react";
import type { KnowledgeStatus } from "@/lib/admin/types";

/**
 * Two-tone folder glyph, drawn entirely in `currentColor` so a single
 * Tailwind text-* class recolors it. Shared by the folder grid cards and the
 * modal header so a source's status reads visually, not just via badge text.
 */
export function FolderGlyph({
  toneClass,
  className = "h-12 w-16",
}: {
  toneClass: string;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 64 48" className={`${toneClass} ${className}`} xmlns="http://www.w3.org/2000/svg">
      <path d="M2 10a4 4 0 0 1 4-4h13l6 6h33a4 4 0 0 1 4 4v3H2v-9Z" fill="currentColor" opacity="0.35" />
      <path d="M2 15h60v25a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V15Z" fill="currentColor" />
    </svg>
  );
}

/** Maps a knowledge source's status to the tone its folder glyph + accents use. */
export function folderToneClass(status: KnowledgeStatus): string {
  if (status === "Indexed") return "text-emerald-500";
  if (status === "Processing") return "text-amber-500";
  return "text-red-500"; // Error
}

/** Icon + tint for a file, guessed from its extension. Purely cosmetic. */
export function fileVisual(name: string): { Icon: LucideIcon; toneClass: string } {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) {
    return { Icon: FileImage, toneClass: "text-purple-400" };
  }
  if (["csv", "xls", "xlsx"].includes(ext)) {
    return { Icon: FileSpreadsheet, toneClass: "text-emerald-500" };
  }
  if (["json", "md", "yml", "yaml"].includes(ext)) {
    return { Icon: FileCode2, toneClass: "text-sky-500" };
  }
  if (["pdf", "doc", "docx", "txt"].includes(ext)) {
    return { Icon: FileText, toneClass: "text-accent" };
  }
  return { Icon: FileIcon, toneClass: "text-stone-400" };
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
