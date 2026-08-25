import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { toConversationDTO, type ConversationRow, type PersonaRow } from "@/lib/admin/types";
import { asRecord, badRequest, notFound, serverError } from "@/lib/admin/api-utils";

// POST /api/conversations — called when an employee picks an avatar on
// /experience and lands on /conversation. Creates the session row and
// returns everything VoiceConversationScreen needs as initial props
// (assistantName, assistantRole) — no STT/LLM/avatar-stream setup happens
// here, that's wired separately per the earlier architecture discussion
// (Deepgram/HeyGen tokens minted by their own routes).
export async function POST(req: NextRequest) {
  try {
    const body = asRecord(await req.json());

    const personaId = body.personaId;
    if (typeof personaId !== "string" || !personaId) return badRequest("`personaId` is required");

    const { data: persona, error: personaError } = await supabaseAdmin
      .from("personas")
      .select("*")
      .eq("id", personaId)
      .maybeSingle();
    if (personaError) throw personaError;
    if (!persona) return notFound(`Persona ${personaId} not found`);

    const personaRow = persona as PersonaRow;

    const { data: conversation, error: conversationError } = await supabaseAdmin
      .from("conversations")
      .insert({
        name: typeof body.name === "string" ? body.name : `${personaRow.name} session`,
        is_public: Boolean(body.isPublic),
        personal_avatar_request: Boolean(body.personalAvatarRequest),
        active_avatar_id: personaRow.avatar_id,
        persona_id: personaRow.id,
        conversation_type: body.conversationType === "Text" ? "Text" : "Voice",
        language: typeof body.language === "string" ? body.language : "English",
        creator_user: typeof body.creatorUser === "string" ? body.creatorUser : "anonymous",
        status: "Active",
      })
      .select("*")
      .single();

    if (conversationError) throw conversationError;

    const conversationRow = conversation as ConversationRow;

    return NextResponse.json(
      {
        conversation: toConversationDTO(conversationRow),
        // Ready-to-use props for VoiceConversationScreen — brandName is a
        // fixed org constant, everything else comes from the persona row.
        // `voice.gender` (the only field personas actually has for this —
        // see types.ts's 2026-07-30 note on the removed tone-slider
        // columns) + the conversation's `language` are what the client
        // needs to pick the right free Edge TTS voice via /api/tts
        // (see lib/llm/models.ts#resolveTtsVoice).
        screenProps: {
          brandName: "PWC",
          assistantName: personaRow.name,
          assistantRole: personaRow.role_title || personaRow.type || "Assistant",
          language: conversationRow.language,
          voice: {
            gender: personaRow.gender,
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return serverError(error);
  }
}