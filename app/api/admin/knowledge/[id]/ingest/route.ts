import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ingestKnowledgeSource } from "@/lib/ingestion/pipeline";
import { notFound, serverError } from "@/lib/admin/api-utils";

type Params = { params: Promise<{ id: string }> };

// POST /api/admin/knowledge/:id/ingest — (re)runs the RAG pipeline for every
// file registered under this source. Files also ingest automatically as
// they're uploaded (see files/route.ts); this route is for manual retry
// after an "Error" status or a bulk reindex.
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    const { data: source, error } = await supabaseAdmin
      .from("knowledge_sources")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!source) return notFound(`Knowledge source ${id} not found`);

    await ingestKnowledgeSource(id);

    return NextResponse.json({ ingested: true });
  } catch (error) {
    return serverError(error);
  }
}
