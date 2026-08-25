"use client";

import { StatusBadge, formatTunisTime } from "@/components/admin/table/Table";
import { ActionsMenu } from "@/components/admin/table/ActionsMenu";
import { knowledgeTone } from "@/lib/admin/mock-data";
import type { KnowledgeSource } from "@/lib/admin/types";
import { FolderGlyph, folderToneClass } from "./knowledge-visuals";

/**
 * A single knowledge source rendered as a "folder" tile instead of a table
 * row. Clicking anywhere on the card opens the quick-look popup
 * (KnowledgeFolderModal); the kebab menu in the corner keeps the existing
 * View/Edit/Delete actions available without leaving the grid.
 */
export function KnowledgeFolderCard({
  source,
  onOpen,
  onChanged,
}: {
  source: KnowledgeSource;
  onOpen: () => void;
  onChanged: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group relative flex cursor-pointer flex-col gap-4 rounded-3xl border border-stone-200/70 bg-white p-6 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
    >
      {/* Stops the click from bubbling up and opening the modal underneath the menu. */}
      <div className="absolute right-3 top-3" onClick={(e) => e.stopPropagation()}>
        <ActionsMenu variant="knowledge" source={source} onChanged={onChanged} />
      </div>

      <FolderGlyph toneClass={folderToneClass(source.status)} />

      <div className="min-w-0">
        <h3 className="truncate pr-8 text-base font-semibold text-stone-900">{source.name}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-stone-500">{source.description || "No description yet."}</p>
      </div>

      <div className="mt-auto flex items-center justify-between pt-1 text-xs text-stone-400">
        <StatusBadge label={source.status} tone={knowledgeTone(source.status)} />
        <span>
          {source.fileCount} file{source.fileCount === 1 ? "" : "s"} · {formatTunisTime(source.updatedAt)}
        </span>
      </div>
    </div>
  );
}
