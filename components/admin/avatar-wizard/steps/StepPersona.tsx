"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { AdminCard } from "@/components/admin/AdminCard";
import { Table, THead, Th, Tr, Td, StatusBadge } from "@/components/admin/table/Table";
import { ActionsMenu } from "@/components/admin/table/ActionsMenu";
import { publishTone } from "@/lib/admin/mock-data";
import type { Persona } from "@/lib/admin/types";
import type { WizardData } from "../wizard-types";
import { PersonaFieldsForm } from "./PersonaFieldsForm";

function CreativityBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-14 rounded-full bg-stone-100">
        <div className="h-1.5 rounded-full bg-accent" style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-stone-500">{value}%</span>
    </div>
  );
}

export function StepPersona({
  data,
  onChange,
}: {
  data: WizardData["persona"];
  onChange: (next: WizardData["persona"]) => void;
}) {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/personas")
      .then((res) => res.json())
      .then((rows: Persona[]) => {
        if (!cancelled) setPersonas(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
            Use an existing persona
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...data, mode: "new" })}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              data.mode === "new" ? "bg-stone-900 text-white" : "border border-stone-200 text-stone-600"
            }`}
          >
            Create a new persona
          </button>
        </div>

        {data.mode === "existing" ? (
          loading ? (
            <p className="text-sm text-stone-500">Loading personas…</p>
          ) : personas.length === 0 ? (
            <p className="text-sm text-stone-500">No personas yet — create a new one instead.</p>
          ) : (
            <Table>
              <THead>
                <tr>
                  <Th>Select</Th>
                  <Th>Type</Th>
                  <Th>Name</Th>
                  <Th className="min-w-[240px]">Prompt</Th>
                  <Th>Q&amp;A model</Th>
                  <Th>Creativity</Th>
                  <Th>Status</Th>
                  <Th>Version</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </THead>
              <tbody>
                {personas.map((persona) => {
                  const selected = data.existingPersonaId === persona.id;
                  return (
                    <Tr key={persona.id} className={selected ? "bg-accent/5" : ""}>
                      <Td>
                        <button
                          type="button"
                          onClick={() => onChange({ ...data, existingPersonaId: persona.id })}
                          aria-label={`Select ${persona.name}`}
                          aria-pressed={selected}
                          className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
                            selected ? "border-accent bg-accent text-white" : "border-stone-300"
                          }`}
                        >
                          {selected ? <Check className="h-3 w-3" /> : null}
                        </button>
                      </Td>
                      <Td>{persona.type}</Td>
                      <Td className="font-medium text-stone-900">{persona.name}</Td>
                      <Td className="max-w-xs">
                        <span className="block truncate text-stone-500" title={persona.prompt}>
                          {persona.prompt}
                        </span>
                      </Td>
                      <Td>{persona.qnaModel}</Td>
                      <Td>
                        <CreativityBar value={persona.creativity} />
                      </Td>
                      <Td>
                        <StatusBadge label={persona.status} tone={publishTone(persona.status)} />
                      </Td>
                      <Td>{persona.version}</Td>
                      <Td className="text-right">
                        <ActionsMenu variant="persona" persona={persona} onChanged={() => {}} />
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          )
        ) : (
          <div className="flex flex-col gap-6">
            <PersonaFieldsForm
              data={{
                name: data.name,
                type: data.type,
                prompt: data.prompt,
                qnaModel: data.qnaModel,
                creativity: data.creativity,
                gender: data.gender,
              }}
              onChange={(next) => onChange({ ...data, ...next })}
            />

            <div className="border-t border-stone-100 pt-6">
              <p className="mb-3 text-sm font-medium text-stone-700">Preview</p>
              <Table>
                <THead>
                  <tr>
                    <Th>Type</Th>
                    <Th>Name</Th>
                    <Th className="min-w-[240px]">Prompt</Th>
                    <Th>Q&amp;A model</Th>
                    <Th>Creativity</Th>
                    <Th>Status</Th>
                    <Th>Version</Th>
                  </tr>
                </THead>
                <tbody>
                  <Tr>
                    <Td>{data.type || "—"}</Td>
                    <Td className="font-medium text-stone-900">{data.name || "Untitled persona"}</Td>
                    <Td className="max-w-xs">
                      <span className="block truncate text-stone-500" title={data.prompt}>
                        {data.prompt || "—"}
                      </span>
                    </Td>
                    <Td>{data.qnaModel}</Td>
                    <Td>
                      <CreativityBar value={data.creativity} />
                    </Td>
                    <Td>
                      <StatusBadge label="Private" tone="neutral" />
                    </Td>
                    <Td>v1.0</Td>
                  </Tr>
                </tbody>
              </Table>
            </div>
          </div>
        )}
      </AdminCard>
    </div>
  );
}
