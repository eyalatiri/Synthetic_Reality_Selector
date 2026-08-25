import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { toKnowledgeFileDTO, type KnowledgeFileRow } from "@/lib/admin/types";
import { badRequest, notFound, serverError } from "@/lib/admin/api-utils";
import { ingestKnowledgeFile } from "@/lib/ingestion/pipeline";
import { fetchAndExtractUrl } from "@/lib/ingestion/fetchUrl";

type Params = { params: Promise<{ id: string }> };

const STORAGE_BUCKET = "knowledge";

/**
 * Supabase Storage keys reject spaces, accented characters, and various
 * punctuation. This only sanitizes the *storage path* — the human-readable
 * title (with accents, spaces, etc. intact) still goes into the `name`
 * column for display, so French/Arabic/etc. titles show correctly in the UI
 * even though the underlying file key is ASCII-safe.
 */
function slugifyForStorageKey(input: string): string {
  const withoutDiacritics = input.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // é -> e, ç -> c, etc.
  const slug = withoutDiacritics
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 150);
  return slug || "webpage";
}

// POST /api/admin/knowledge/:id/urls — register a web page as a knowledge
// file. Fetches the URL server-side, extracts its main readable content,
// stores that extracted text as a .md file in Storage, then runs it through
// the exact same ingestion pipeline as an uploaded file (see files/route.ts)
// — extract.ts/chunk.ts/embed.ts/pipeline.ts don't know or care that this
// content originated from a URL rather than an upload.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    const body = await req.json().catch(() => null);
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    if (!url) return badRequest("`url` is required (JSON body: { \"url\": \"https://...\" })");

    const { data: source, error: sourceError } = await supabaseAdmin
      .from("knowledge_sources")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (sourceError) throw sourceError;
    if (!source) return notFound(`Knowledge source ${id} not found`);

    // Let fetch/extraction errors (bad URL, unreachable, non-HTML, no
    // readable content) surface as a 400 rather than a generic 500 — these
    // are user-input problems ("that link doesn't work"), not server bugs.
    let page;
    try {
      page = await fetchAndExtractUrl(url);
    } catch (fetchErr) {
      return badRequest(fetchErr instanceof Error ? fetchErr.message : `Could not process "${url}"`);
    }

    const safeName = `${slugifyForStorageKey(page.title || "webpage")}.md`;
    const storagePath = `${id}/${crypto.randomUUID()}-${safeName}`;
    const bytes = Buffer.from(page.textContent, "utf-8");

    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, bytes, { contentType: "text/markdown", upsert: false });
    if (uploadError) throw uploadError;

    const { data, error } = await supabaseAdmin
      .from("knowledge_files")
      .insert({
        knowledge_source_id: id,
        name: page.title || url,
        size_bytes: bytes.byteLength,
        storage_path: storagePath,
        source_url: url,
      })
      .select("*")
      .single();
    if (error) throw error;

    const fileRow = data as KnowledgeFileRow;

    try {
      await ingestKnowledgeFile(fileRow.id);
    } catch (ingestError) {
      // Same pattern as files/route.ts — the file/URL stays registered even
      // if ingestion fails; the source's status flips to "Error" inside
      // ingestKnowledgeFile so the admin UI surfaces it.
      console.error(`Ingestion failed for file ${fileRow.id} (from URL ${url}):`, ingestError);
    }

    return NextResponse.json(toKnowledgeFileDTO(fileRow), { status: 201 });
  } catch (error) {
    return serverError(error);
  }
}
