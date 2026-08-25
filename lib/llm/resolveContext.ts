import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  toPersonaDTO,
  type AvatarCombinationRow,
  type AvatarRow,
  type Persona,
  type PersonaRow,
} from "@/lib/admin/types";

export type ResolvedChatContext = {
  avatarName: string;
  persona: Persona;
  knowledgeSourceIds: string[];
};

/**
 * Resolves everything /api/chat needs for a *persisted* avatar/persona pair
 * — the real employee-facing flow (/experience -> /conversation). A
 * persona can in principle be reused across avatars, so it's the
 * avatar_combinations row (not the persona alone) that says which
 * knowledge source(s) apply to this particular pairing.
 *
 * Accepts any one of combinationId, personaId, or avatarId+personaId —
 * whatever the caller already has on hand.
 */
export async function resolveChatContext({
  personaId,
  avatarId,
  combinationId,
}: {
  personaId?: string;
  avatarId?: string;
  combinationId?: string;
}): Promise<ResolvedChatContext> {
  let resolvedPersonaId = personaId ?? null;
  let resolvedAvatarId = avatarId ?? null;
  let knowledgeSourceIds: string[] = [];

  if (combinationId) {
    const { data: combo, error } = await supabaseAdmin
      .from("avatar_combinations")
      .select("*")
      .eq("id", combinationId)
      .maybeSingle();
    if (error) throw error;
    if (!combo) throw new Error(`Combination ${combinationId} not found`);

    const comboRow = combo as AvatarCombinationRow;
    resolvedPersonaId = resolvedPersonaId ?? comboRow.persona_id;
    resolvedAvatarId = comboRow.avatar_id;
    knowledgeSourceIds = comboRow.knowledge_source_ids ?? [];
  }

  if (!resolvedPersonaId) {
    throw new Error("personaId or combinationId is required to resolve a chat context");
  }

  const { data: persona, error: personaError } = await supabaseAdmin
    .from("personas")
    .select("*")
    .eq("id", resolvedPersonaId)
    .maybeSingle();
  if (personaError) throw personaError;
  if (!persona) throw new Error(`Persona ${resolvedPersonaId} not found`);

  const personaRow = persona as PersonaRow;
  resolvedAvatarId = resolvedAvatarId ?? personaRow.avatar_id;

  // No combination row looked up yet (caller passed personaId/avatarId
  // directly, e.g. from the /conversation?avatar=&persona= query params) —
  // find the one linking this exact avatar+persona pairing so the right
  // knowledge source(s) get searched.
  if (knowledgeSourceIds.length === 0 && resolvedAvatarId) {
    const { data: combo, error } = await supabaseAdmin
      .from("avatar_combinations")
      .select("*")
      .eq("avatar_id", resolvedAvatarId)
      .eq("persona_id", resolvedPersonaId)
      .maybeSingle();
    if (error) throw error;
    if (combo) knowledgeSourceIds = (combo as AvatarCombinationRow).knowledge_source_ids ?? [];
  }

  let avatarName = personaRow.name;
  if (resolvedAvatarId) {
    const { data: avatar, error: avatarError } = await supabaseAdmin
      .from("avatars")
      .select("*")
      .eq("id", resolvedAvatarId)
      .maybeSingle();
    if (avatarError) throw avatarError;
    if (avatar) avatarName = (avatar as AvatarRow).name;
  }

  return {
    avatarName,
    persona: toPersonaDTO(personaRow),
    knowledgeSourceIds,
  };
}
