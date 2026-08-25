import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  toKnowledgeSourceDTOFromJoin,
  KNOWLEDGE_SOURCE_WITH_COUNT_SELECT,
  type KnowledgeSourceRowWithCount,
} from "@/lib/admin/types";
import { asRecord, notFound, serverError } from "@/lib/admin/api-utils";

type Params = { params: Promise<{ id: string }> };

// GET /api/admin/knowledge/:id
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from("knowledge_sources")
      .select(KNOWLEDGE_SOURCE_WITH_COUNT_SELECT)
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return notFound(`Knowledge source ${id} not found`);

    return NextResponse.json(toKnowledgeSourceDTOFromJoin(data as KnowledgeSourceRowWithCount));
  } catch (error) {
    return serverError(error);
  }
}

// PATCH /api/admin/knowledge/:id — rename/redescribe, or flip status once
// ingestion (the AI part) finishes indexing.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = asRecord(await req.json());

    const patch: Record<string, unknown> = {};
    if (typeof body.name === "string") patch.name = body.name;
    if (typeof body.description === "string") patch.description = body.description;
    if (["Indexed", "Processing", "Error"].includes(body.status as string)) {
      patch.status = body.status;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("knowledge_sources")
      .update(patch)
      .eq("id", id)
      .select(KNOWLEDGE_SOURCE_WITH_COUNT_SELECT)
      .maybeSingle();

    if (error) throw error;
    if (!data) return notFound(`Knowledge source ${id} not found`);

    return NextResponse.json(toKnowledgeSourceDTOFromJoin(data as KnowledgeSourceRowWithCount));
  } catch (error) {
    return serverError(error);
  }
}

// DELETE /api/admin/knowledge/:id — cascades to its knowledge_files rows.
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    const { error, count } = await supabaseAdmin
      .from("knowledge_sources")
      .delete({ count: "exact" })
      .eq("id", id);

    if (error) throw error;
    if (!count) return notFound(`Knowledge source ${id} not found`);

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return serverError(error);
  }
}
