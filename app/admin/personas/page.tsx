"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { AdminPageHeader, AdminPrimaryButton } from "@/components/admin/AdminPageHeader";
import { Table, THead, Th, Tr, Td, StatusBadge } from "@/components/admin/table/Table";
import { ActionsMenu } from "@/components/admin/table/ActionsMenu";
import { publishTone } from "@/lib/admin/mock-data";
import type { Persona } from "@/lib/admin/types";

export default function PersonasIndexPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    return fetch("/api/admin/personas")
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load personas");
        return res.json();
      })
      .then((data: Persona[]) => setPersonas(data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load personas"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return (
    <>
      <AdminPageHeader
        title="Personas"
        subtitle="How each avatar thinks, speaks, and represents PwC."
        action={
          <Link href="/admin/personas/new">
            <AdminPrimaryButton>
              <span className="flex items-center gap-2">
                <Plus className="h-4 w-4" /> Add persona
              </span>
            </AdminPrimaryButton>
          </Link>
        }
      />

      <div className="mt-8">
        {error ? (
          <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
        ) : loading ? (
          <p className="text-sm text-stone-500">Loading personas…</p>
        ) : personas.length === 0 ? (
          <p className="text-sm text-stone-500">No personas yet.</p>
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Type</Th>
                <Th>Name</Th>
                <Th className="min-w-[280px]">Prompt</Th>
                <Th>Q&amp;A model</Th>
                <Th>Creativity</Th>
                <Th>Status</Th>
                <Th>Version</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </THead>
            <tbody>
              {personas.map((persona) => (
                <Tr key={persona.id}>
                  <Td>{persona.type}</Td>
                  <Td className="font-medium text-stone-900">{persona.name}</Td>
                  <Td className="max-w-xs">
                    <span className="block truncate text-stone-500" title={persona.prompt}>
                      {persona.prompt}
                    </span>
                  </Td>
                  <Td>{persona.qnaModel}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 rounded-full bg-stone-100">
                        <div className="h-1.5 rounded-full bg-accent" style={{ width: `${persona.creativity}%` }} />
                      </div>
                      <span className="text-xs text-stone-500">{persona.creativity}%</span>
                    </div>
                  </Td>
                  <Td>
                    <StatusBadge label={persona.status} tone={publishTone(persona.status)} />
                  </Td>
                  <Td>{persona.version}</Td>
                  <Td className="text-right">
                    <ActionsMenu variant="persona" persona={persona} onChanged={refetch} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </>
  );
}
