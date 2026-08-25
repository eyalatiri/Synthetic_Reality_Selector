import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  toAvatarDTO,
  toKnowledgeSourceDTOFromJoin,
  toPersonaDTO,
  KNOWLEDGE_SOURCE_WITH_COUNT_SELECT,
  type AvatarCombinationRow,
  type AvatarRow,
  type KnowledgeSourceRowWithCount,
  type PersonaRow,
  type ResolvedCombination,
} from "@/lib/admin/types";
import { asRecord, notFound, serverError } from "@/lib/admin/api-utils";

// Next.js 15+ dynamic params are async
type Params = { params: Promise<{ id: string }> };

async function resolveCombination(id: string): Promise<ResolvedCombination | null> {
  const { data: combo, error: comboError } = await supabaseAdmin
    .from("avatar_combinations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (comboError) throw comboError;
  if (!combo) return null;

  const row = combo as AvatarCombinationRow;

  const [avatarRes, personaRes, knowledgeRes] = await Promise.all([
    supabaseAdmin.from("avatars").select("*").eq("id", row.avatar_id).maybeSingle(),

    supabaseAdmin.from("personas").select("*").eq("id", row.persona_id).maybeSingle(),

    row.knowledge_source_ids.length > 0
      ? supabaseAdmin
          .from("knowledge_sources")
          .select(KNOWLEDGE_SOURCE_WITH_COUNT_SELECT)
          .in("id", row.knowledge_source_ids)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (avatarRes.error) throw avatarRes.error;
  if (personaRes.error) throw personaRes.error;
  if (knowledgeRes.error) throw knowledgeRes.error;

  if (!avatarRes.data || !personaRes.data) return null;

  const knowledgeSources = (knowledgeRes.data as KnowledgeSourceRowWithCount[]).map(
    (k) => toKnowledgeSourceDTOFromJoin(k)
  );

  return {
    id: row.id,
    avatar: toAvatarDTO(avatarRes.data as AvatarRow),
    persona: toPersonaDTO(personaRes.data as PersonaRow),
    knowledgeSources,
  };
}


// GET /api/admin/combinations/:id
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    const combination = await resolveCombination(id);

    if (!combination) {
      return notFound(`Combination ${id} not found`);
    }

    return NextResponse.json(combination);
  } catch (error) {
    return serverError(error);
  }
}


// PATCH /api/admin/combinations/:id
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    const body = asRecord(await req.json());

    const patch: Record<string, unknown> = {};

    if (typeof body.avatarId === "string") {
      patch.avatar_id = body.avatarId;
    }

    if (typeof body.personaId === "string") {
      patch.persona_id = body.personaId;
    }

    if (Array.isArray(body.knowledgeSourceIds)) {
      patch.knowledge_source_ids = body.knowledgeSourceIds.filter(
        (value): value is string => typeof value === "string"
      );
    }


    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "No updatable fields provided" },
        { status: 400 }
      );
    }


    const { data, error } = await supabaseAdmin
      .from("avatar_combinations")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle();


    if (error) throw error;

    if (!data) {
      return notFound(`Combination ${id} not found`);
    }


    const resolved = await resolveCombination(id);

    if (!resolved) {
      return notFound(`Combination ${id} not found after update`);
    }

    return NextResponse.json(resolved);

  } catch (error) {
    return serverError(error);
  }
}


// DELETE /api/admin/combinations/:id
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    const { error, count } = await supabaseAdmin
      .from("avatar_combinations")
      .delete({ count: "exact" })
      .eq("id", id);


    if (error) throw error;

    if (!count) {
      return notFound(`Combination ${id} not found`);
    }


    return NextResponse.json({ deleted: true });

  } catch (error) {
    return serverError(error);
  }
}
