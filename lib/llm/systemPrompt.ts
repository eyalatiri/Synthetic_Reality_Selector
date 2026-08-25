import type { RetrievedChunk } from "@/lib/ingestion/retrieve";

// Deliberately a superset of both shapes /api/chat can receive a persona
// as: the full DB `Persona` DTO (lib/admin/types.ts) for the real
// employee-facing /conversation flow, and the avatar wizard's in-memory
// draft (WizardData["persona"]) for the pre-publish "Test" step.
//
// expertise/formality/empathy/humour/confidence/forbiddenTopics/
// escalationInstructions were removed on 2026-07-30 - they were read here
// previously but never existed as columns on the real `personas` table
// (see supabase/migrations/0004_persona_gender.sql's comment for the full
// audit), so `select("*")` always returned them as undefined and this
// entire tone/guardrail paragraph was silently a no-op. If/when those
// fields get real columns + admin UI support again, reintroduce the
// corresponding paragraphs below using the same pattern.
export type PersonaPromptInput = {
  name?: string;
  prompt?: string;
  roleTitle?: string;
  department?: string;
};

export function buildSystemPrompt({
  avatarName,
  persona,
  contextChunks,
  language,
}: {
  avatarName: string;
  persona: PersonaPromptInput;
  contextChunks: RetrievedChunk[];
  /** Conversation's configured spoken language ("English" | "French" | "Arabic"). See lib/llm/models.ts#resolveSpokenLanguage. When set, this is authoritative — the model must not switch languages just because the user did. Omit to let the model mirror whatever language the user writes/speaks in. */
  language?: string;
}): string {
  const lines: string[] = [];
  const displayName = persona.name || avatarName;

  lines.push(`You are ${displayName}, a digital human avatar built by PwC Tunisia for internal employees.`);

  if (persona.roleTitle) {
    lines.push(`Role: ${persona.roleTitle}${persona.department ? ` — ${persona.department}` : ""}.`);
  }

  // Authoritative language lock. Without this, the model defaults to
  // mirroring whatever language the user's (transcribed) message happens
  // to be in — which is why a conversation configured for English kept
  // answering in French: nothing ever told it English was fixed, so it
  // just followed the user's spoken input every time.
  if (language?.trim()) {
    lines.push("");
    lines.push(
      `Always respond in ${language.trim()}, in every single reply, no matter what language the user writes or ` +
        `speaks in. Do not switch languages to match the user, and do not mix in words from another language. ` +
        `If the user seems more comfortable in a different language, still answer in ${language.trim()} — a ` +
        `human moderator can change the conversation's language setting if needed.`
    );
  }

  if (persona.prompt?.trim()) {
    lines.push("");
    lines.push("Persona instructions from the admin who configured you:");
    lines.push(persona.prompt.trim());
  }

  lines.push("");
  if (contextChunks.length > 0) {
    lines.push(
      "Use the following knowledge-base excerpts to ground your answer when they're relevant. Don't invent " +
        "policy details that aren't supported by them — if the excerpts don't cover the question, say you're " +
        "not certain and offer to escalate instead of guessing."
    );
    contextChunks.forEach((chunk, i) => {
      lines.push(`\n[Source ${i + 1}]\n${chunk.content}`);
    });
  } else {
    lines.push(
      "No knowledge-base excerpts were retrieved for this question (either nothing matched, or no knowledge " +
        "source is attached yet). Answer from general reasoning and be upfront that you don't have a specific " +
        "document to point to."
    );
  }

  lines.push("");
  lines.push(
    "Keep replies conversational and concise — two to four sentences unless the question genuinely needs a " +
      "list or step-by-step instructions. This is a spoken/voice conversation, not a written report."
  );

  // Your reply is spoken aloud by a TTS engine, not rendered as text — it
  // reads formatting characters literally (e.g. "*" gets spoken as a
  // stray sound/word), which is why odd noises/words show up in the
  // audio even though they're not "real" words. Plain prose only.
  lines.push("");
  lines.push(
    "Write in plain spoken prose only — no markdown at all. Do not use asterisks, underscores, backticks, " +
      "pound signs/headers, hyphen or numbered list markers, or brackets/links. If you need to list a few " +
      "items, say them in a sentence (e.g. \"first ... then ... finally ...\") instead of using list formatting. " +
      "Every character you write will be read aloud exactly as typed, so anything that isn't a word a person " +
      "would actually say out loud should not appear in your reply."
  );

  return lines.join("\n");
}