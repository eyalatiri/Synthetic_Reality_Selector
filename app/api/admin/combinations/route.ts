import { NextResponse } from "next/server";
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
import { serverError } from "@/lib/admin/api-utils";

// GET /api/admin/combinations
//
// Admin-facing sibling of /api/experience/combinations. Same shape
// (ResolvedCombination[]) and same join logic, but deliberately WITHOUT the
// "avatar AND persona must both be Published" filter that route applies —
// the dashboard needs to show Draft/Archived combinations too, since seeing
// what you're still working on is the point of an overview page. Keep that
// filter only in the /experience route; employees should never see
// unpublished pairs.
export async function GET() {
  try {
    const { data: combos, error: comboError } = await supabaseAdmin.from("avatar_combinations").select("*");
    if (comboError) throw comboError;

    const rows = combos as AvatarCombinationRow[];
    if (rows.length === 0) return NextResponse.json([]);

    const avatarIds = [...new Set(rows.map((c) => c.avatar_id))];
    const personaIds = [...new Set(rows.map((c) => c.persona_id))];
    const knowledgeIds = [...new Set(rows.flatMap((c) => c.knowledge_source_ids))];

    const [avatarsRes, personasRes, knowledgeRes] = await Promise.all([
      supabaseAdmin.from("avatars").select("*").in("id", avatarIds),
      supabaseAdmin.from("personas").select("*").in("id", personaIds),
      knowledgeIds.length > 0
        ? supabaseAdmin.from("knowledge_sources").select(KNOWLEDGE_SOURCE_WITH_COUNT_SELECT).in("id", knowledgeIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (avatarsRes.error) throw avatarsRes.error;
    if (personasRes.error) throw personasRes.error;
    if (knowledgeRes.error) throw knowledgeRes.error;

    const avatarsById = new Map((avatarsRes.data as AvatarRow[]).map((a) => [a.id, a]));
    const personasById = new Map((personasRes.data as PersonaRow[]).map((p) => [p.id, p]));
    const knowledgeById = new Map(
      (knowledgeRes.data as KnowledgeSourceRowWithCount[]).map((k) => [k.id, toKnowledgeSourceDTOFromJoin(k)])
    );

    const resolved: ResolvedCombination[] = [];
    for (const combo of rows) {
      const avatar = avatarsById.get(combo.avatar_id);
      const persona = personasById.get(combo.persona_id);
      if (!avatar || !persona) continue; // orphaned row — shouldn't happen given the FKs, skip defensively

      resolved.push({
        id: combo.id,
        avatar: toAvatarDTO(avatar),
        persona: toPersonaDTO(persona),
        knowledgeSources: combo.knowledge_source_ids
          .map((id) => knowledgeById.get(id))
          .filter((k): k is NonNullable<typeof k> => Boolean(k)),
      });
    }

    return NextResponse.json(resolved);
  } catch (error) {
    return serverError(error);
  }
}
