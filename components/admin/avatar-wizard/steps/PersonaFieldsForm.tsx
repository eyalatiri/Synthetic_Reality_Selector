"use client";

import { QNA_MODELS } from "@/lib/admin/mock-data";
import type { QnaModel, PersonaGender } from "@/lib/admin/types";

export type PersonaFieldsData = {
  name: string;
  type: string;
  prompt: string;
  qnaModel: QnaModel;
  creativity: number;
  gender: PersonaGender;
};

export function PersonaFieldsForm({
  data,
  onChange,
}: {
  data: PersonaFieldsData;
  onChange: (next: PersonaFieldsData) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">Persona name</span>
          <input
            value={data.name}
            onChange={(e) => onChange({ ...data, name: e.target.value })}
            placeholder="e.g. Aura"
            className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-accent"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">Type</span>
          <input
            value={data.type}
            onChange={(e) => onChange({ ...data, type: e.target.value })}
            placeholder="e.g. HR assistant"
            className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-accent"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-stone-700">Prompt</span>
        <textarea
          value={data.prompt}
          onChange={(e) => onChange({ ...data, prompt: e.target.value })}
          rows={4}
          placeholder="You are ... Answer employee questions about ... with a ... tone."
          className="w-full resize-none rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-accent"
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">Q&amp;A model</span>
          <select
            value={data.qnaModel}
            onChange={(e) => onChange({ ...data, qnaModel: e.target.value as QnaModel })}
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
            Creativity <span className="text-stone-400">{data.creativity}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={data.creativity}
            onChange={(e) => onChange({ ...data, creativity: Number(e.target.value) })}
            className="w-full accent-accent"
          />
        </div>
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-medium text-stone-700">Voice</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange({ ...data, gender: "female" })}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              data.gender === "female" ? "bg-stone-900 text-white" : "border border-stone-200 text-stone-600"
            }`}
          >
            Female
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...data, gender: "male" })}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              data.gender === "male" ? "bg-stone-900 text-white" : "border border-stone-200 text-stone-600"
            }`}
          >
            Male
          </button>
        </div>
      </div>
    </div>
  );
}
