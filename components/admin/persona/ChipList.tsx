"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";

type ChipListProps = {
  chips: string[];
  onChange: (chips: string[]) => void;
  tone?: "neutral" | "warn";
  addLabel?: string;
};

export function ChipList({ chips, onChange, tone = "neutral", addLabel = "Add" }: ChipListProps) {
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);

  const chipClass =
    tone === "warn"
      ? "border-red-200 bg-red-50 text-red-600"
      : "border-stone-200 bg-stone-100 text-stone-700";

  function commitDraft() {
    const value = draft.trim();
    if (value && !chips.includes(value)) onChange([...chips, value]);
    setDraft("");
    setAdding(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-stone-200 bg-white p-3">
      {chips.map((chip) => (
        <span
          key={chip}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium ${chipClass}`}
        >
          {chip}
          <button
            type="button"
            aria-label={`Remove ${chip}`}
            onClick={() => onChange(chips.filter((c) => c !== chip))}
            className="opacity-60 transition-opacity hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      ))}

      {adding ? (
        <input
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") commitDraft();
            if (event.key === "Escape") {
              setDraft("");
              setAdding(false);
            }
          }}
          placeholder="Type and press Enter"
          className="w-44 rounded-full border border-stone-200 px-3 py-1.5 text-sm outline-none focus:border-accent"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 rounded-full border border-dashed border-stone-300 px-3 py-1.5 text-sm text-stone-500 transition-colors hover:border-accent hover:text-accent"
        >
          <Plus className="h-3.5 w-3.5" /> {addLabel}
        </button>
      )}
    </div>
  );
}
