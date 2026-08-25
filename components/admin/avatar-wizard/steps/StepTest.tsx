"use client";

import { useState } from "react";
import { Send, AlertTriangle } from "lucide-react";
import { AdminLivePanel } from "@/components/admin/AdminCard";
import { useChatStream } from "@/hooks/useChatStream";
import type { WizardData } from "../wizard-types";

export function StepTest({ data }: { data: WizardData }) {
  const avatarName = data.avatar.name || "Your avatar";
  const knowledgeSourceIds = data.knowledge.mode === "existing" ? data.knowledge.selectedIds : [];
  const knowledgeCount =
    data.knowledge.mode === "existing" ? data.knowledge.selectedIds.length : data.knowledge.newSource.files.length > 0 ? 1 : 0;

  // Preview mode: nothing about this avatar is persisted yet (Publish
  // hasn't been clicked), so there's no personaId to look up — the wizard's
  // in-memory draft (data.persona) is sent straight through as
  // `personaOverride` and /api/chat builds the system prompt from it
  // directly. Real, already-indexed knowledge sources (mode "existing")
  // are searched live; a brand-new, not-yet-ingested source has nothing to
  // search yet, so it's left out until Publish runs the ingestion.
  const { messages, streamingText, isStreaming, escalated, error, send } = useChatStream({
    mode: "preview",
    avatarName,
    personaOverride: data.persona,
    knowledgeSourceIds,
  });

  const [draft, setDraft] = useState("");

  function handleSend() {
    const text = draft.trim();
    if (!text || isStreaming) return;
    send(text);
    setDraft("");
  }

  const greeting = `Hi, I'm ${avatarName}. Ask me something from the ${
    knowledgeCount ? `${knowledgeCount} knowledge area${knowledgeCount > 1 ? "s" : ""} you picked` : "knowledge base"
  }.`;

  return (
    <AdminLivePanel>
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/40">Live test session</p>
        {data.knowledge.mode === "new" ? (
          <span className="text-right text-[11px] text-white/40">
            New knowledge isn&rsquo;t indexed yet — answers won&rsquo;t use it until you publish.
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <div className="max-w-[92%] rounded-2xl rounded-tl-sm bg-white/10 px-4 py-3 text-sm leading-relaxed text-white/90">
          {greeting}
        </div>

        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              m.role === "user"
                ? "ml-auto rounded-tr-sm bg-accent/20 text-white"
                : "rounded-tl-sm bg-white/10 text-white/90"
            }`}
          >
            {m.content}
          </div>
        ))}

        {isStreaming ? (
          <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white/10 px-4 py-3 text-sm leading-relaxed text-white/90">
            {streamingText || "…"}
          </div>
        ) : null}
      </div>

      {escalated ? (
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-amber-500/15 px-3 py-2 text-xs text-amber-200">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          This reply tripped a guardrail — it would be flagged for escalation in a real session.
        </div>
      ) : null}

      {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}

      <div className="mt-5 flex items-center gap-2 rounded-2xl bg-white/5 p-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a test message…"
          disabled={isStreaming}
          className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={isStreaming}
          aria-label="Send test message"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white transition-transform hover:scale-105 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </AdminLivePanel>
  );
}
