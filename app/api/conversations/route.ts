import { after, NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { toConversationDTO, type AvatarRow, type ConversationRow, type PersonaRow } from "@/lib/admin/types";
import { musetalkBaseUrl, primeSourceVideo } from "@/lib/musetalk/client";
import { getSessionProfile } from "@/lib/auth/guards";
import { asRecord, badRequest, notFound, serverError } from "@/lib/admin/api-utils";

// POST /api/conversations — called when an employee picks an avatar on
// /experience and lands on /conversation. Creates the session row and
// returns everything VoiceConversationScreen needs as initial props
// (assistantName, assistantRole, avatar video) — no STT/LLM setup happens
// here; MuseTalk lip-sync is requested per reply by /api/avatar/lip-sync.
export async function POST(req: NextRequest) {
  try {
    const body = asRecord(await req.json());
    // Stamped from the session, never from the request body (it would be spoofable).
    const session = await getSessionProfile();

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

    // ---- Avatar + MuseTalk readiness ------------------------------------
    // MuseTalk is NOT started here — it runs per reply, via
    // /api/avatar/lip-sync. All this does is (1) hand the UI the avatar's
    // idle-loop video, (2) tell it whether lip-sync is reachable right now
    // (so it doesn't wait on a dead Kaggle tunnel every turn), and (3) warm
    // the server-side copy of the source video so the first reply isn't
    // slowed by a Supabase download.
    //
    // Which avatar? The one the employee actually picked, NOT blindly
    // personas.avatar_id: a persona is a 1:1 pointer that gets re-linked
    // whenever another wizard run reuses it ("existing persona" mode), so it
    // can point at a different avatar (often one with no video) than the
    // combination on /experience. Order: combination -> avatarId from the
    // URL -> persona's own link.
    let resolvedAvatarId: string | null = null;
    if (typeof body.combinationId === "string" && body.combinationId) {
      const { data: combo } = await supabaseAdmin
        .from("avatar_combinations")
        .select("avatar_id")
        .eq("id", body.combinationId)
        .maybeSingle();
      resolvedAvatarId = (combo?.avatar_id as string | undefined) ?? null;
    }
    if (!resolvedAvatarId && typeof body.avatarId === "string" && body.avatarId) resolvedAvatarId = body.avatarId;
    if (!resolvedAvatarId) resolvedAvatarId = personaRow.avatar_id;

    let avatarRow: AvatarRow | null = null;
    if (resolvedAvatarId) {
      const { data: avatarData, error: avatarError } = await supabaseAdmin
        .from("avatars")
        .select("*")
        .eq("id", resolvedAvatarId)
        .maybeSingle();
      if (avatarError) throw avatarError;
      avatarRow = (avatarData as AvatarRow | null) ?? null;
    }
    const avatarVideoUrl = avatarRow?.video_url ?? null;

    const { data: conversation, error: conversationError } = await supabaseAdmin
      .from("conversations")
      .insert({
        name: typeof body.name === "string" ? body.name : `${personaRow.name} session`,
        is_public: Boolean(body.isPublic),
        personal_avatar_request: Boolean(body.personalAvatarRequest),
        active_avatar_id: avatarRow?.id ?? personaRow.avatar_id,
        persona_id: personaRow.id,
        conversation_type: body.conversationType === "Text" ? "Text" : "Voice",
        language: typeof body.language === "string" ? body.language : "English",
        creator_user: session?.email ?? "anonymous",
        status: "Active",
      })
      .select("*")
      .single();

    if (conversationError) throw conversationError;

    const conversationRow = conversation as ConversationRow;

    // "Can we ATTEMPT lip-sync?" = the avatar has a video and the service URL
    // is configured. Deliberately NOT a live health check: a one-off probe
    // that times out on a slow network (or hits a cold ngrok tunnel) used to
    // switch lip-sync off for the whole conversation. Real reachability is
    // discovered by the first reply (and /api/avatar/status).
    const lipSync = Boolean(avatarVideoUrl) && musetalkBaseUrl() !== null;
    console.log(
      `[musetalk] conversation start: avatar=${avatarRow?.id ?? "none"} video=${avatarVideoUrl ? "yes" : "NO"} ` +
        `KAGGLE_MUSETALK_URL=${musetalkBaseUrl() ? "set" : "MISSING"} -> lip-sync ${lipSync ? "enabled" : "DISABLED"}`
    );
    if (lipSync && avatarVideoUrl) after(() => primeSourceVideo(avatarVideoUrl));

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
          avatar: avatarRow
            ? {
                id: avatarRow.id,
                name: avatarRow.name,
                // blob: URLs (saved by older wizard runs) are dead after the tab closes.
                imageUrl: avatarRow.image_url?.startsWith("http") ? avatarRow.image_url : null,
                videoUrl: avatarVideoUrl,
                // true = this avatar has a video and KAGGLE_MUSETALK_URL is set.
                // The client still falls back to voice-only if a call fails.
                lipSync,
              }
            : null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return serverError(error);
  }
}