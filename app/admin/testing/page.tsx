"use client";

import { useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Table, THead, Th, Tr, Td, StatusBadge, formatTunisTime } from "@/components/admin/table/Table";
import { ActionsMenu } from "@/components/admin/table/ActionsMenu";
import { testTone } from "@/lib/admin/mock-data";
import type { TestCase, Conversation } from "@/lib/admin/types";

export default function TestingLabPage() {
  const [tests, setTests] = useState<TestCase[]>([]);
  const [conversationNames, setConversationNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch("/api/admin/tests").then((res) => {
        if (!res.ok) throw new Error("Failed to load tests");
        return res.json();
      }),
      fetch("/api/admin/conversations").then((res) => (res.ok ? res.json() : [])),
    ])
      .then(([testData, convData]: [TestCase[], Conversation[]]) => {
        if (cancelled) return;
        setTests(testData);
        setConversationNames(Object.fromEntries(convData.map((c) => [c.id, c.name])));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load tests");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <AdminPageHeader
        title="Testing lab"
        subtitle="Simulate conversations, compare versions, and catch hallucinations before launch."
      />

      <div className="mt-8">
        {error ? (
          <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
        ) : loading ? (
          <p className="text-sm text-stone-500">Loading tests…</p>
        ) : tests.length === 0 ? (
          <p className="text-sm text-stone-500">No tests yet.</p>
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Name</Th>
                <Th>Conversation</Th>
                <Th>Created (GMT+1)</Th>
                <Th>Type</Th>
                <Th>Total questions</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </THead>
            <tbody>
              {tests.map((test) => (
                <Tr key={test.id}>
                  <Td className="font-medium text-stone-900">{test.name}</Td>
                  <Td className="text-stone-500">
                    {(test.conversationId && conversationNames[test.conversationId]) || "—"}
                  </Td>
                  <Td>{formatTunisTime(test.createdAt)}</Td>
                  <Td>{test.type}</Td>
                  <Td>{test.totalQuestions}</Td>
                  <Td>
                    <StatusBadge label={test.status} tone={testTone(test.status)} />
                  </Td>
                  <Td className="text-right">
                    <ActionsMenu name={test.name} />
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
