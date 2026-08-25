import { supabaseAdmin } from "@/lib/supabase/admin";
import { searchKnowledgeChunks, type RetrievedChunk } from "@/lib/ingestion/retrieve";
import { buildSystemPrompt, type PersonaPromptInput } from "./systemPrompt";
import { streamChatMessage, type ChatMessage, type ChatUsage } from "./chatClient";
import { resolveModelId } from "./models";
import {
  logChatMetrics,
  persistChatMetrics,
  LOW_CONFIDENCE_THRESHOLD,
  type ChatTurnMetrics,
  type RetrievalMetrics,
} from "./metrics";

export type ChatPipelinePersona = PersonaPromptInput & {
  qnaModel?: string;
  creativity?: number;
};

export type ChatPipelineInput = {
  avatarName: string;
  persona: ChatPipelinePersona;
  knowledgeSourceIds: string[];
  message: string;
  history: ChatMessage[];
  /** When set, the turn gets logged to conversation_messages and can flag the conversation as Escalated. */
  conversationId?: string | null;
  /**
   * Conversation's spoken language ("English" | "French" | "Arabic") -
   * forwarded straight into buildSystemPrompt()'s language lock so the
   * reply comes back in the language the user is actually speaking right
   * now, not just whatever the model infers from the transcribed text.
   * See app/api/chat/route.ts (reads this from the request body) and
   * lib/llm/systemPrompt.ts (where the lock instruction is built).
   */
  language?: string;
};

// Widened from 5/6 after observing a real recall miss: "qui a fonde
// carthage?" didn't surface the founding-date chunk in the top 5, but a
// near-paraphrase ("qui a fonde ce site") found it as chunk #1. Pulling
// more candidates per source before ranking gives borderline-relevant
// chunks like that a chance to make the cut; MAX_CONTEXT_CHUNKS still caps
// what actually goes to the LLM so prompt size/cost doesn't grow with it.
const MATCHES_PER_SOURCE = 10;
const MAX_CONTEXT_CHUNKS = 8;

/**
 * Vector search across every knowledge source tied to this persona/avatar
 * combination, merged and re-ranked - timed per source so a single slow
 * or retrying source shows up by id instead of just inflating one opaque
 * total.
 */
async function retrieveContext(
  query: string,
  knowledgeSourceIds: string[]
): Promise<{ chunks: RetrievedChunk[]; metrics: RetrievalMetrics }> {
  const start = Date.now();

  if (knowledgeSourceIds.length === 0) {
    return {
      chunks: [],
      metrics: {
        knowledgeSourceIds,
        perSourceMs: {},
        totalMs: 0,
        chunksReturned: 0,
        chunksUsed: 0,
        topSimilarity: null,
        avgSimilarity: null,
        minSimilarity: null,
        similaritySpread: null,
        lowConfidenceChunks: 0,
        belowConfidenceThreshold: false,
        sourcesWithNoResults: [],
        sourcesFailed: [],
      },
    };
  }

  const perSourceMs: Record<string, number> = {};
  const sourcesWithNoResults: string[] = [];
  const sourcesFailed: string[] = [];

  const results = await Promise.allSettled(
    knowledgeSourceIds.map(async (id) => {
      const sourceStart = Date.now();
      try {
        const found = await searchKnowledgeChunks(query, id, MATCHES_PER_SOURCE);
        perSourceMs[id] = Date.now() - sourceStart;
        if (found.length === 0) sourcesWithNoResults.push(id);
        return found;
      } catch (err) {
        perSourceMs[id] = Date.now() - sourceStart;
        throw err;
      }
    })
  );

  const allChunks: RetrievedChunk[] = [];
  knowledgeSourceIds.forEach((id, i) => {
    const result = results[i];
    if (result.status === "fulfilled") {
      allChunks.push(...result.value);
    } else {
      sourcesFailed.push(id);
      console.error(`Knowledge retrieval failed for source ${id}:`, result.reason);
    }
  });

  const chunksReturned = allChunks.length;
  const topChunks = allChunks.sort((a, b) => b.similarity - a.similarity).slice(0, MAX_CONTEXT_CHUNKS);
  const similarities = topChunks.map((c) => c.similarity);
  const lowConfidenceChunks = similarities.filter((s) => s < LOW_CONFIDENCE_THRESHOLD).length;

  return {
    chunks: topChunks,
    metrics: {
      knowledgeSourceIds,
      perSourceMs,
      totalMs: Date.now() - start,
      chunksReturned,
      chunksUsed: topChunks.length,
      topSimilarity: similarities[0] ?? null,
      avgSimilarity:
        similarities.length > 0
          ? Number((similarities.reduce((a, b) => a + b, 0) / similarities.length).toFixed(4))
          : null,
      minSimilarity: similarities.length > 0 ? similarities[similarities.length - 1] : null,
      similaritySpread:
        similarities.length > 0 ? Number((similarities[0] - similarities[similarities.length - 1]).toFixed(4)) : null,
      lowConfidenceChunks,
      belowConfidenceThreshold: similarities.length > 0 && lowConfidenceChunks === similarities.length,
      sourcesWithNoResults,
      sourcesFailed,
    },
  };
}

/** Best-effort transcript logging - a missing conversation_messages table shouldn't break the live chat. */
async function logMessages(conversationId: string | null | undefined, userMessage: string, assistantMessage: string) {
  if (!conversationId) return;
  try {
    const { error } = await supabaseAdmin.from("conversation_messages").insert([
      { conversation_id: conversationId, role: "user", content: userMessage },
      { conversation_id: conversationId, role: "assistant", content: assistantMessage },
    ]);
    if (error) throw error;
  } catch (err) {
    console.error("Failed to log conversation messages (run supabase/migrations/0003_conversation_messages.sql?):", err);
  }
}

function sseFrame(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

/**
 * RAG retrieval -> persona-shaped system prompt -> streamed chat completion
 * (Groq-hosted open-weight model - see lib/llm/models.ts) -> conversation
 * logging -> metrics.
 *
 * NOTE: the guardrail/escalation step (forbidden-topic keyword matching,
 * see lib/llm/guardrail.ts) was removed from this pipeline on 2026-07-30 -
 * it depended on persona.forbiddenTopics, which was never a real column on
 * the personas table (select("*") always returned undefined for it), so it
 * was already a permanent no-op. guardrail.ts itself is left in place,
 * unused, in case forbidden_topics gets a real column + admin UI later -
 * re-wire it here (and flagEscalation, also removed) at that point.
 *
 * Frame types sent to the client:
 *   {type:"sources", sources:[{id, similarity}]}                - once, after retrieval
 *   {type:"delta", text}                                        - many, as tokens arrive
 *   {type:"done", fullText, provider, metrics}                  - once, at the end
 *   {type:"error", message}                                      - instead of "done" on failure
 */
export function runChatPipeline(input: ChatPipelineInput): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(data: unknown) {
        controller.enqueue(encoder.encode(sseFrame(data)));
      }

      const turnStart = Date.now();
      let fullText = "";
      let genStart = Date.now();

      try {
        const { chunks: contextChunks, metrics: retrievalMetrics } = await retrieveContext(
          input.message,
          input.knowledgeSourceIds
        );

        // TEMP DEBUG — remove once retrieval quality is confirmed. Logs what
        // was actually retrieved (not just the score) so we can tell a
        // content gap apart from a chunking/embedding problem.
        console.log(`[retrieval-debug] query="${input.message}"`);
        contextChunks.forEach((c, i) => {
          console.log(
            `[retrieval-debug]   #${i + 1} sim=${c.similarity.toFixed(4)} chunk=${c.id}\n` +
              `    "${c.content.slice(0, 300).replace(/\n/g, " ")}${c.content.length > 300 ? "..." : ""}"`
          );
        });

        send({ type: "sources", sources: contextChunks.map((c) => ({ id: c.id, similarity: c.similarity })) });

        const system = buildSystemPrompt({
          avatarName: input.avatarName,
          persona: input.persona,
          contextChunks,
          language: input.language,
        });

        const model = resolveModelId(input.persona.qnaModel);
        const temperature =
          typeof input.persona.creativity === "number" ? Math.min(1, Math.max(0, input.persona.creativity / 100)) : 0.5;

        const messages: ChatMessage[] = [...input.history, { role: "user", content: input.message }];

        const usageOut: { current: ChatUsage | null } = { current: null };
        genStart = Date.now();
        let firstTokenAt: number | null = null;

        for await (const delta of streamChatMessage({ model, system, messages, temperature, usageOut })) {
          if (firstTokenAt === null) firstTokenAt = Date.now();
          fullText += delta;
          send({ type: "delta", text: delta });
        }
        const genEnd = Date.now();

        await logMessages(input.conversationId, input.message, fullText);

        const generationTotalMs = genEnd - genStart;
        const usage = usageOut.current;

        const metrics: ChatTurnMetrics = {
          conversationId: input.conversationId ?? null,
          personaName: input.persona.name || input.avatarName,
          message: input.message,
          retrieval: retrievalMetrics,
          generation: {
            provider: "groq",
            model,
            temperature,
            timeToFirstTokenMs: firstTokenAt !== null ? firstTokenAt - genStart : null,
            totalGenerationMs: generationTotalMs,
            outputChars: fullText.length,
            promptTokens: usage?.promptTokens ?? null,
            completionTokens: usage?.completionTokens ?? null,
            tokensPerSecond:
              usage && generationTotalMs > 0
                ? Number((usage.completionTokens / (generationTotalMs / 1000)).toFixed(1))
                : null,
          },
          guardrail: { escalate: false, reason: null },
          totalTurnMs: Date.now() - turnStart,
        };

        logChatMetrics(metrics);
        await persistChatMetrics(metrics);

        send({ type: "done", escalate: false, reason: null, fullText, provider: "groq", metrics });
      } catch (err) {
        console.error("Chat pipeline error:", err);
        send({ type: "error", message: err instanceof Error ? err.message : "Unexpected error" });
      } finally {
        controller.close();
      }
    },
  });
}