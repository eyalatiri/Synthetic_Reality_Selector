// lib/llm/metrics.ts

export type RetrievalMetrics = {
  knowledgeSourceIds: string[];
  perSourceMs: Record<string, number>;
  totalMs: number;
  chunksReturned: number;
  chunksUsed: number;
  topSimilarity: number | null;
  avgSimilarity: number | null;
  /** Weakest score among the chunks actually sent to the model. */
  minSimilarity: number | null;
  /** topSimilarity - minSimilarity. Wide spread = one strong hit propping up a weak set. */
  similaritySpread: number | null;
  /** Count of used chunks scoring below LOW_CONFIDENCE_THRESHOLD - a proxy for "context probably isn't relevant." */
  lowConfidenceChunks: number;
  /** True when every used chunk is below threshold - the strongest signal that the answer isn't grounded in real context. */
  belowConfidenceThreshold: boolean;
  /** Sources queried that returned zero chunks - flags a source with sparse/missing coverage for this query. */
  sourcesWithNoResults: string[];
  /** Sources whose query threw (timeout, RPC error, etc.), separate from "queried fine but found nothing." */
  sourcesFailed: string[];
};

/** Below this cosine similarity, a retrieved chunk is treated as noise rather than real context (tune against real query/answer pairs). */
export const LOW_CONFIDENCE_THRESHOLD = 0.5;

export type ChatTurnMetrics = {
  conversationId: string | null;
  personaName: string;
  message: string;
  retrieval: RetrievalMetrics;
  generation: {
    provider: string;
    model: string;
    temperature: number;
    timeToFirstTokenMs: number | null;
    totalGenerationMs: number;
    outputChars: number;
    promptTokens: number | null;
    completionTokens: number | null;
    tokensPerSecond: number | null;
  };
  guardrail: {
    escalate: boolean;
    reason: string | null;
  };
  totalTurnMs: number;
};

/** Console-only metrics logging. No persistence — swap in a real store later if needed. */
export function logChatMetrics(metrics: ChatTurnMetrics): void {
  console.log(
    `[chat-metrics] persona="${metrics.personaName}" turn=${metrics.totalTurnMs}ms ` +
      `retrieval=${metrics.retrieval.totalMs}ms (${metrics.retrieval.chunksUsed}/${metrics.retrieval.chunksReturned} chunks, ` +
      `top=${metrics.retrieval.topSimilarity ?? "n/a"}, avg=${metrics.retrieval.avgSimilarity ?? "n/a"}, ` +
      `min=${metrics.retrieval.minSimilarity ?? "n/a"}, spread=${metrics.retrieval.similaritySpread ?? "n/a"}) ` +
      `gen=${metrics.generation.totalGenerationMs}ms ttft=${metrics.generation.timeToFirstTokenMs ?? "n/a"}ms ` +
      `tok/s=${metrics.generation.tokensPerSecond ?? "n/a"} (${metrics.generation.promptTokens ?? "?"}→${metrics.generation.completionTokens ?? "?"} tok) ` +
      `escalate=${metrics.guardrail.escalate}${metrics.guardrail.reason ? ` (${metrics.guardrail.reason})` : ""}`
  );

  if (Object.keys(metrics.retrieval.perSourceMs).length > 0) {
    console.log("[chat-metrics] per-source retrieval:", metrics.retrieval.perSourceMs);
  }

  if (metrics.retrieval.belowConfidenceThreshold && metrics.retrieval.chunksUsed > 0) {
    console.warn(
      `[chat-metrics] LOW CONFIDENCE: all ${metrics.retrieval.chunksUsed} used chunk(s) scored below ${LOW_CONFIDENCE_THRESHOLD} for message="${metrics.message}"`
    );
  }
  if (metrics.retrieval.sourcesWithNoResults.length > 0) {
    console.warn("[chat-metrics] sources with zero results:", metrics.retrieval.sourcesWithNoResults);
  }
  if (metrics.retrieval.sourcesFailed.length > 0) {
    console.warn("[chat-metrics] sources that errored:", metrics.retrieval.sourcesFailed);
  }
}

/** No-op for now — persistence disabled until a chat_metrics table exists. */
export async function persistChatMetrics(_metrics: ChatTurnMetrics): Promise<void> {
  return;
}