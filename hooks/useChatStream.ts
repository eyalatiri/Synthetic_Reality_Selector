"use client";

import { useCallback, useRef, useState } from "react";

export type ChatRole = "user" | "assistant";
export type ChatMessage = { role: ChatRole; content: string };
export type SourceRef = { id: string; similarity: number };

// Two ways to drive /api/chat from the client — mirrors the two request
// shapes the route accepts (see app/api/chat/route.ts):
//
//  - "persisted": a real personaId that exists in Supabase (the employee
//    /conversation screen). Optionally logs the turn if conversationId is set.
//  - "preview": an in-memory persona draft with no DB id yet (the admin
//    avatar wizard's "Test" step, before Publish). Nothing gets logged.
export type ChatTarget =
  | {
      mode: "persisted";
      personaId: string;
      avatarId?: string;
      combinationId?: string;
      conversationId?: string | null;
      /** Conversation's spoken language ("English" | "French" | "Arabic") - locks the reply language server-side. See app/api/chat/route.ts + lib/llm/systemPrompt.ts. */
      language?: string;
    }
  | {
      mode: "preview";
      avatarName: string;
      personaOverride: Record<string, unknown>;
      knowledgeSourceIds: string[];
      /** Same as above - optional here since the wizard "Test" step has no conversation language yet. */
      language?: string;
    };

type StreamEvent =
  | { type: "sources"; sources: SourceRef[] }
  | { type: "delta"; text: string }
  | { type: "done"; escalate: boolean; reason: string | null; fullText: string }
  | { type: "error"; message: string };

export function useChatStream(target: ChatTarget) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [sources, setSources] = useState<SourceRef[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (text: string, languageOverride?: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      setError(null);
      setStreamingText("");
      setSources([]);

      const history = messages; // snapshot before this turn is appended
      setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      // languageOverride wins when passed — this is what lets a
      // just-detected language (e.g. from STT on this exact turn) lock
      // this turn's reply immediately, instead of waiting a render cycle
      // for target.language (driven by React state in the caller) to
      // catch up. See components/chat/ConversationChat.tsx.
      const language = languageOverride ?? target.language;

      const payload =
        target.mode === "persisted"
          ? {
              personaId: target.personaId,
              avatarId: target.avatarId,
              combinationId: target.combinationId,
              conversationId: target.conversationId ?? undefined,
              message: trimmed,
              history,
              language,
            }
          : {
              personaOverride: target.personaOverride,
              avatarName: target.avatarName,
              knowledgeSourceIds: target.knowledgeSourceIds,
              message: trimmed,
              history,
              language,
            };

      let full = "";

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!res.body) throw new Error("No response body from /api/chat");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";

          for (const frame of frames) {
            const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
            if (!dataLine) continue;

            const jsonStr = dataLine.slice(5).trim();
            if (!jsonStr) continue;

            let event: StreamEvent;
            try {
              event = JSON.parse(jsonStr);
            } catch {
              continue;
            }

            if (event.type === "delta") {
              full += event.text;
              setStreamingText((prev) => prev + event.text);
            } else if (event.type === "sources") {
              setSources(event.sources ?? []);
            } else if (event.type === "done") {
              full = event.fullText ?? full;
              setEscalated(Boolean(event.escalate));
            } else if (event.type === "error") {
              throw new Error(event.message ?? "Chat stream error");
            }
          }
        }

        setMessages((prev) => [...prev, { role: "assistant", content: full }]);
        setStreamingText("");
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setError(err.message || "Failed to reach the assistant");
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, isStreaming, target]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { messages, streamingText, isStreaming, escalated, sources, error, send, stop };
}