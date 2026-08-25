import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  toAvatarDTO,
  toKnowledgeSourceDTO,
  toPersonaDTO,
  type AvatarCombinationRow,
  type AvatarRow,
  type KnowledgeSourceRow,
  type PersonaRow,
  type ResolvedCombination,
} from "@/lib/admin/types";
import { serverError } from "@/lib/admin/api-utils";

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
      // Fixed: was .eq("status", "Published") — never matched real rows,
      // so a fully-published combination could never appear on /experience.
      supabaseAdmin.from("avatars").select("*").in("id", avatarIds).eq("status", "Public"),
      supabaseAdmin.from("personas").select("*").in("id", personaIds).eq("status", "Public"),
      knowledgeIds.length > 0
        ? supabaseAdmin.from("knowledge_sources").select("*, knowledge_files(count)").in("id", knowledgeIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (avatarsRes.error) throw avatarsRes.error;
    if (personasRes.error) throw personasRes.error;
    if (knowledgeRes.error) throw knowledgeRes.error;

    const avatarsById = new Map((avatarsRes.data as AvatarRow[]).map((a) => [a.id, a]));
    const personasById = new Map((personasRes.data as PersonaRow[]).map((p) => [p.id, p]));
    const knowledgeById = new Map(
      (knowledgeRes.data as (KnowledgeSourceRow & { knowledge_files: { count: number }[] })[]).map((k) => [
        k.id,
        toKnowledgeSourceDTO(k, k.knowledge_files?.[0]?.count ?? 0),
      ])
    );

    const resolved: ResolvedCombination[] = [];
    for (const combo of rows) {
      const avatar = avatarsById.get(combo.avatar_id);
      const persona = personasById.get(combo.persona_id);
      if (!avatar || !persona) continue;

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
