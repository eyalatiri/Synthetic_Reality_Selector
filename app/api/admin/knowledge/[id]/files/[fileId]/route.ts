import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { notFound, serverError } from "@/lib/admin/api-utils";
import type { KnowledgeFileRow } from "@/lib/admin/types";

type Params = { params: Promise<{ id: string; fileId: string }> };

const STORAGE_BUCKET = "knowledge";

// DELETE /api/admin/knowledge/:id/files/:fileId
// Removes the metadata row, the underlying Storage object, and its
// knowledge_chunks (cascaded via FK — see 0002_knowledge_chunks.sql).
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id, fileId } = await params;

    const { data: fileData, error: fetchError } = await supabaseAdmin
      .from("knowledge_files")
      .select("*")
      .eq("id", fileId)
      .eq("knowledge_source_id", id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!fileData) return notFound(`File ${fileId} not found on source ${id}`);

    const storagePath = (fileData as KnowledgeFileRow).storage_path;
    if (storagePath) {
      const { error: removeError } = await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([storagePath]);
      if (removeError) console.error(`Failed to remove storage object ${storagePath}:`, removeError);
    }

    const { error, count } = await supabaseAdmin
      .from("knowledge_files")
      .delete({ count: "exact" })
      .eq("id", fileId)
      .eq("knowledge_source_id", id);

    if (error) throw error;
    if (!count) return notFound(`File ${fileId} not found on source ${id}`);

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return serverError(error);
  }
}
