import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  toKnowledgeSourceDTO,
  toKnowledgeSourceDTOFromJoin,
  KNOWLEDGE_SOURCE_WITH_COUNT_SELECT,
  type KnowledgeSourceRowWithCount,
  type KnowledgeSourceRow,
} from "@/lib/admin/types";
import { badRequest, serverError, asRecord } from "@/lib/admin/api-utils";

// GET /api/admin/knowledge — list every knowledge source with its file count
// (fileCount is derived via a count aggregate, never stored directly).
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("knowledge_sources")
      .select(KNOWLEDGE_SOURCE_WITH_COUNT_SELECT)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const rows = data as KnowledgeSourceRowWithCount[];
    return NextResponse.json(rows.map(toKnowledgeSourceDTOFromJoin));
  } catch (error) {
    return serverError(error);
  }
}

// POST /api/admin/knowledge — create a new knowledge source's metadata.
// Actual files are registered separately via
// POST /api/admin/knowledge/:id/files (see that route for why upload is
// split from source creation).
export async function POST(req: NextRequest) {
  try {
    const body = asRecord(await req.json());

    const name = body.name;
    if (typeof name !== "string" || !name.trim()) return badRequest("`name` is required");

    const { data, error } = await supabaseAdmin
      .from("knowledge_sources")
      .insert({
        name,
        description: typeof body.description === "string" ? body.description : "",
        status: typeof body.status === "string" ? body.status : "Processing",
      })
      .select("*")
      .single();

    if (error) throw error;

    // Brand new — no files can exist for it yet, so fileCount is trivially 0.
    return NextResponse.json(toKnowledgeSourceDTO(data as KnowledgeSourceRow, 0), { status: 201 });
  } catch (error) {
    return serverError(error);
  }
}
