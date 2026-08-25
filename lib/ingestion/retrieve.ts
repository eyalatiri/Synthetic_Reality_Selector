import { supabaseAdmin } from "@/lib/supabase/admin";
import { embedTexts } from "./embed";

export type RetrievedChunk = {
  id: string;
  knowledgeFileId: string;
  content: string;
  similarity: number;
};

type MatchRow = { id: string; knowledge_file_id: string; content: string; similarity: number };

/**
 * Hybrid search (vector + French full-text, combined via Reciprocal Rank
 * Fusion) scoped to a single knowledge_source_id — the chatbot passes the
 * source tied to the active persona/avatar combination. The scoping is
 * enforced inside the match_knowledge_chunks SQL function itself (see
 * migration adding content_fts + the hybrid rewrite of the function), so
 * results can never cross into another source's chunks even if a caller
 * omits the filter.
 *
 * Pure vector search alone missed direct-answer chunks when query phrasing
 * diverged from the source text (e.g. "qui a fonde carthage" failed to
 * surface a chunk literally containing "fondee par Didon... 814 av. J.-C."
 * even at a widened candidate count) - the keyword side of the fusion
 * catches those via literal term matches instead of semantic similarity
 * alone.
 */
export async function searchKnowledgeChunks(
  query: string,
  knowledgeSourceId: string,
  matchCount = 6
): Promise<RetrievedChunk[]> {
  const [queryEmbedding] = await embedTexts([query], "query");

  const { data, error } = await supabaseAdmin.rpc("match_knowledge_chunks", {
    query_embedding: queryEmbedding,
    query_text: query,
    filter_source_id: knowledgeSourceId,
    match_count: matchCount,
  });
  if (error) throw error;

  return ((data ?? []) as MatchRow[]).map((row) => ({
    id: row.id,
    knowledgeFileId: row.knowledge_file_id,
    content: row.content,
    similarity: row.similarity,
  }));
}