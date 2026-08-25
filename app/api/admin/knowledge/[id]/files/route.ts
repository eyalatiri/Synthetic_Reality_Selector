import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { toKnowledgeFileDTO, type KnowledgeFileRow } from "@/lib/admin/types";
import { badRequest, notFound, serverError } from "@/lib/admin/api-utils";
import { ingestKnowledgeFile } from "@/lib/ingestion/pipeline";

type Params = { params: Promise<{ id: string }> };

const STORAGE_BUCKET = "knowledge";

// GET /api/admin/knowledge/:id/files — list files registered under a source.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from("knowledge_files")
      .select("*")
      .eq("knowledge_source_id", id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json((data as KnowledgeFileRow[]).map(toKnowledgeFileDTO));
  } catch (error) {
    return serverError(error);
  }
}

// POST /api/admin/knowledge/:id/files — multipart/form-data upload.
// Uploads the file's bytes to Supabase Storage, registers its metadata row,
// then runs the RAG ingestion pipeline for it (extract → chunk → embed →
// store in knowledge_chunks — see lib/ingestion/pipeline.ts). Ingestion runs
// before responding so the client gets the source's final status
// ("Indexed"/"Error") in the same round trip as the upload.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return badRequest("`file` is required (multipart/form-data)");

    // Confirm the parent source exists first for a clean 404 instead of an
    // FK violation.
    const { data: source, error: sourceError } = await supabaseAdmin
      .from("knowledge_sources")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (sourceError) throw sourceError;
    if (!source) return notFound(`Knowledge source ${id} not found`);

    const storagePath = `${id}/${crypto.randomUUID()}-${file.name}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, bytes, { contentType: file.type || undefined, upsert: false });
    if (uploadError) throw uploadError;

    const { data, error } = await supabaseAdmin
      .from("knowledge_files")
      .insert({
        knowledge_source_id: id,
        name: file.name,
        size_bytes: file.size,
        storage_path: storagePath,
      })
      .select("*")
      .single();

    if (error) throw error;

    const fileRow = data as KnowledgeFileRow;

    try {
      await ingestKnowledgeFile(fileRow.id);
    } catch (ingestError) {
      // File stays registered even if ingestion fails — the source's status
      // is already flipped to "Error" inside ingestKnowledgeFile, so the
      // admin UI surfaces it without losing the uploaded file.
      console.error(`Ingestion failed for file ${fileRow.id}:`, ingestError);
    }

    return NextResponse.json(toKnowledgeFileDTO(fileRow), { status: 201 });
  } catch (error) {
    return serverError(error);
  }
}
