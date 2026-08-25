"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { AdminPageHeader, AdminPrimaryButton } from "@/components/admin/AdminPageHeader";
import { Table, THead, Th, Tr, Td, StatusBadge } from "@/components/admin/table/Table";
import { ActionsMenu } from "@/components/admin/table/ActionsMenu";
import { publishTone } from "@/lib/admin/mock-data";
import type { ResolvedCombination } from "@/lib/admin/types";

export default function AdminDashboardPage() {
  const [combinations, setCombinations] = useState<ResolvedCombination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCombinations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/combinations");
      if (!res.ok) {
        throw new Error((await res.json()).error ?? "Failed to load combinations");
      }
      setCombinations(await res.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load combinations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCombinations();
  }, [fetchCombinations]);


  return (
    <>
      <AdminPageHeader
        title="Agents"
        subtitle="Active avatars, conversation volume, and knowledge health at a glance."
        action={
          <Link href="/admin/avatars/new">
            <AdminPrimaryButton>
              <span className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create agent
              </span>
            </AdminPrimaryButton>
          </Link>
        }
      />

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-stone-500">
          Agents available
        </h2>

        {error ? (
          <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        ) : loading ? (
          <p className="text-sm text-stone-500">Loading agents...</p>
        ) : combinations.length === 0 ? (
          <p className="text-sm text-stone-500">
            No combinations yet — use "Create agent" to pair an avatar with a
            persona and knowledge.
          </p>
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Avatar</Th>
                <Th>Persona</Th>
                <Th>Knowledge sources</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </THead>

            <tbody>
              {combinations.map((combo) => (
                <Tr key={combo.id}>
                  <Td className="font-medium text-stone-900">
                    {combo.avatar.name}
                  </Td>

                  <Td>
                    {combo.persona.name}
                  </Td>

                  <Td className="text-stone-500">
                    {combo.knowledgeSources.length > 0
                      ? combo.knowledgeSources.map((k) => k.name).join(", ")
                      : "—"}
                  </Td>

                  <Td>
                    <StatusBadge
                      label={combo.avatar.status}
                      tone={publishTone(combo.avatar.status)}
                    />
                  </Td>

                  <Td className="text-right">
                    <ActionsMenu variant="combination" combination={combo} onChanged={fetchCombinations} />
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
