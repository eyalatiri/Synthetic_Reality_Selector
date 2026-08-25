import { supabaseAdmin } from "@/lib/supabase/admin";
import type { KnowledgeFileRow, KnowledgeStatus } from "@/lib/admin/types";
import { extractText } from "./extract";
import { chunkText } from "./chunk";
import { embedTexts } from "./embed";

const STORAGE_BUCKET = "knowledge";

async function setSourceStatus(sourceId: string, status: KnowledgeStatus) {
  const { error } = await supabaseAdmin.from("knowledge_sources").update({ status }).eq("id", sourceId);
  if (error) console.error(`Failed to set status=${status} on source ${sourceId}:`, error);
}

/**
 * Ingests a single knowledge_file: download its bytes from Storage, extract
 * text, chunk it, embed each chunk, and upsert into knowledge_chunks tagged
 * with both knowledge_source_id (retrieval filter) and knowledge_file_id
 * (traceability). Idempotent — reruns replace that file's previous chunks.
 */
export async function ingestKnowledgeFile(fileId: string): Promise<void> {
  const { data: fileData, error: fileError } = await supabaseAdmin
    .from("knowledge_files")
    .select("*")
    .eq("id", fileId)
    .maybeSingle();
  if (fileError) throw fileError;
  if (!fileData) throw new Error(`Knowledge file ${fileId} not found`);

  const file = fileData as KnowledgeFileRow;
  if (!file.storage_path) throw new Error(`Knowledge file ${fileId} has no storage_path to ingest`);

  await setSourceStatus(file.knowledge_source_id, "Processing");

  try {
    const { data: blob, error: downloadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .download(file.storage_path);
    if (downloadError) throw downloadError;

    const buffer = Buffer.from(await blob.arrayBuffer());
    const text = await extractText(buffer, file.storage_path);
    const chunks = chunkText(text);

    const { error: deleteError } = await supabaseAdmin
      .from("knowledge_chunks")
      .delete()
      .eq("knowledge_file_id", fileId);
    if (deleteError) throw deleteError;

    if (chunks.length > 0) {
      const embeddings = await embedTexts(chunks, "document");

      const rows = chunks.map((content, i) => ({
        knowledge_source_id: file.knowledge_source_id,
        knowledge_file_id: fileId,
        chunk_index: i,
        content,
        embedding: embeddings[i],
      }));

      const { error: insertError } = await supabaseAdmin.from("knowledge_chunks").insert(rows);
      if (insertError) throw insertError;
    }

    await setSourceStatus(file.knowledge_source_id, "Indexed");
  } catch (err) {
    await setSourceStatus(file.knowledge_source_id, "Error");
    throw err;
  }
}

/** Re-ingests every file registered under a knowledge_source (bulk reindex). */
export async function ingestKnowledgeSource(sourceId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("knowledge_files")
    .select("id")
    .eq("knowledge_source_id", sourceId);
  if (error) throw error;

  const files = (data ?? []) as { id: string }[];
  if (files.length === 0) {
    await setSourceStatus(sourceId, "Indexed");
    return;
  }

  let hadError = false;
  for (const f of files) {
    try {
      await ingestKnowledgeFile(f.id);
    } catch (err) {
      hadError = true;
      console.error(`Ingestion failed for file ${f.id}:`, err);
    }
  }
  await setSourceStatus(sourceId, hadError ? "Error" : "Indexed");
}
