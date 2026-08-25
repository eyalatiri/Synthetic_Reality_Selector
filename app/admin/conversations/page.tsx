"use client";

import { useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Table, THead, Th, Tr, Td, StatusBadge, BooleanBadge } from "@/components/admin/table/Table";
import { ActionsMenu } from "@/components/admin/table/ActionsMenu";
import { conversationTone } from "@/lib/admin/mock-data";
import type { Conversation, Avatar, Persona } from "@/lib/admin/types";

export default function ConversationCenterPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [avatarNames, setAvatarNames] = useState<Record<string, string>>({});
  const [personaNames, setPersonaNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch("/api/admin/conversations").then((res) => {
        if (!res.ok) throw new Error("Failed to load conversations");
        return res.json();
      }),
      fetch("/api/admin/avatars").then((res) => (res.ok ? res.json() : [])),
      fetch("/api/admin/personas").then((res) => (res.ok ? res.json() : [])),
    ])
      .then(([convData, avatarData, personaData]: [Conversation[], Avatar[], Persona[]]) => {
        if (cancelled) return;
        setConversations(convData);
        setAvatarNames(Object.fromEntries(avatarData.map((a) => [a.id, a.name])));
        setPersonaNames(Object.fromEntries(personaData.map((p) => [p.id, p.name])));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load conversations");
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
        title="Conversation center"
        subtitle="Monitor, review, and export live and past conversations."
      />

      <div className="mt-8">
        {error ? (
          <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
        ) : loading ? (
          <p className="text-sm text-stone-500">Loading conversations…</p>
        ) : conversations.length === 0 ? (
          <p className="text-sm text-stone-500">No conversations yet.</p>
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Name</Th>
                <Th>Public</Th>
                <Th>Status</Th>
                <Th>Personal avatar request</Th>
                <Th>Active avatar</Th>
                <Th>Persona name</Th>
                <Th>Conversation type</Th>
                <Th>Language</Th>
                <Th>Creator user</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </THead>
            <tbody>
              {conversations.map((conv) => (
                <Tr key={conv.id}>
                  <Td className="font-medium text-stone-900">{conv.name}</Td>
                  <Td>
                    <BooleanBadge value={conv.isPublic} />
                  </Td>
                  <Td>
                    <StatusBadge label={conv.status} tone={conversationTone(conv.status)} />
                  </Td>
                  <Td>
                    <BooleanBadge value={conv.personalAvatarRequest} />
                  </Td>
                  <Td>{(conv.activeAvatarId && avatarNames[conv.activeAvatarId]) || "—"}</Td>
                  <Td>{(conv.personaId && personaNames[conv.personaId]) || "—"}</Td>
                  <Td>{conv.conversationType}</Td>
                  <Td>{conv.language}</Td>
                  <Td>{conv.creatorUser}</Td>
                  <Td className="text-right">
                    <ActionsMenu name={conv.name} />
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
