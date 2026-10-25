import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { badRequest, serverError, asRecord } from "@/lib/admin/api-utils";

export async function POST(req: NextRequest) {
  const cleanup: Array<() => Promise<void>> = [];

  try {
    const body = asRecord(await req.json());
    const avatarInput = asRecord(body.avatar);
    const personaInput = asRecord(body.persona);
    const knowledgeInput = asRecord(body.knowledge);

    // avatar.mode ("existing" | "new") mirrors the toggle StepAvatar.tsx now
    // has, same pattern as persona.mode / knowledge.mode below. Older
    // callers that don't send `mode` at all fall back to "new" so this
    // stays backwards compatible.
    let avatarId: string;
    // Hoisted: the persona/knowledge fallbacks below use it in BOTH modes
    // (it was block-scoped inside the "new" branch, so reusing an existing
    // avatar threw a ReferenceError / TS2304 here).
    let avatarName = "";

    if (avatarInput.mode === "existing") {
      const existingAvatarId = avatarInput.existingAvatarId;
      if (typeof existingAvatarId !== "string" || !existingAvatarId) {
        return badRequest("`avatar.existingAvatarId` is required when avatar.mode is 'existing'");
      }

      const { data: existingAvatar, error: existingAvatarError } = await supabaseAdmin
        .from("avatars")
        .select("id, name")
        .eq("id", existingAvatarId)
        .maybeSingle();
      if (existingAvatarError) throw existingAvatarError;
      if (!existingAvatar) return badRequest(`Avatar ${existingAvatarId} not found`);

      avatarId = existingAvatar.id as string;
      avatarName = (existingAvatar.name as string) ?? "";
      // No cleanup pushed here — we didn't create this avatar, so a
      // failure later in this request must never delete it.
    } else {
      if (typeof avatarInput.name !== "string" || !avatarInput.name.trim()) {
        return badRequest("`avatar.name` is required");
      }
      avatarName = avatarInput.name;

      const { data: avatarRow, error: avatarError } = await supabaseAdmin
        .from("avatars")
        .insert({
          name: avatarName,
          owner: typeof avatarInput.owner === "string" ? avatarInput.owner : "",
          owner_type: avatarInput.ownerType === "Individual" ? "Individual" : "Organisation",
          body_type: ["Full body", "Half body", "Head only"].includes(avatarInput.bodyType as string)
            ? avatarInput.bodyType
            : "Half body",
          // imagePreviewUrl is a browser-only blob: URL (URL.createObjectURL in
          // StepAvatar) — dead as soon as the tab closes, so only persist real URLs.
          image_url:
            typeof avatarInput.imagePreviewUrl === "string" && /^https?:\/\//.test(avatarInput.imagePreviewUrl)
              ? avatarInput.imagePreviewUrl
              : null,
          // Set by StepAvatar.tsx once /api/admin/avatars/create-video
          // finishes (the uploaded source clip, already in Supabase
          // Storage — see supabase/migrations/0005_avatar_video_url.sql).
          // Null is valid here too: video is optional, an avatar can still
          // publish with just a static image if no video was uploaded.
          video_url: typeof avatarInput.videoUrl === "string" ? avatarInput.videoUrl : null,
          status: typeof avatarInput.status === "string" ? avatarInput.status : "Private",
        })
        .select("id")
        .single();

      if (avatarError) throw avatarError;
      avatarId = avatarRow.id as string;
      cleanup.push(async () => {
        await supabaseAdmin.from("avatars").delete().eq("id", avatarId);
      });
    }

    let personaId: string;

    if (personaInput.mode === "existing") {
      if (typeof personaInput.existingPersonaId !== "string" || !personaInput.existingPersonaId) {
        return badRequest("`persona.existingPersonaId` is required when persona.mode is 'existing'");
      }
      personaId = personaInput.existingPersonaId;

      const { error: linkError } = await supabaseAdmin
        .from("personas")
        .update({ avatar_id: avatarId })
        .eq("id", personaId);
      if (linkError) throw linkError;
    } else {
      const { data: personaRow, error: personaError } = await supabaseAdmin
        .from("personas")
        .insert({
          avatar_id: avatarId,
          type: typeof personaInput.type === "string" ? personaInput.type : "",
          name: typeof personaInput.name === "string" ? personaInput.name : avatarName,
          prompt: typeof personaInput.prompt === "string" ? personaInput.prompt : "",
          qna_model: typeof personaInput.qnaModel === "string" ? personaInput.qnaModel : "Claude Sonnet",
          creativity: typeof personaInput.creativity === "number" ? personaInput.creativity : 35,
          status: "Private",
          // Drives TTS voice selection - see app/api/conversations/route.ts
          // and supabase/migrations/0004_persona_gender.sql.
          gender: personaInput.gender === "male" ? "male" : "female",
        })
        .select("id")
        .single();

      if (personaError) throw personaError;
      personaId = personaRow.id as string;
      cleanup.push(async () => {
        await supabaseAdmin.from("personas").delete().eq("id", personaId);
      });
    }

    let knowledgeSourceIds: string[] = [];

    if (knowledgeInput.mode === "existing") {
      knowledgeSourceIds = Array.isArray(knowledgeInput.selectedIds) ? (knowledgeInput.selectedIds as string[]) : [];
    } else {
      const newSource = asRecord(knowledgeInput.newSource);
      const files = Array.isArray(newSource.files) ? (newSource.files as Record<string, unknown>[]) : [];

      const { data: sourceRow, error: sourceError } = await supabaseAdmin
        .from("knowledge_sources")
        .insert({
          name: typeof newSource.name === "string" && newSource.name ? newSource.name : `${avatarName} knowledge`,
          description: typeof newSource.description === "string" ? newSource.description : "",
          status: "Processing",
        })
        .select("id")
        .single();

      if (sourceError) throw sourceError;
      const sourceId = sourceRow.id as string;
      cleanup.push(async () => {
        await supabaseAdmin.from("knowledge_sources").delete().eq("id", sourceId);
      });
      knowledgeSourceIds = [sourceId];

      if (files.length > 0) {
        const { error: filesError } = await supabaseAdmin.from("knowledge_files").insert(
          files.map((file) => ({
            knowledge_source_id: sourceId,
            name: typeof file.name === "string" ? file.name : "untitled",
            size_bytes: 0,
          }))
        );
        if (filesError) throw filesError;
      }
    }

    const { data: comboRow, error: comboError } = await supabaseAdmin
      .from("avatar_combinations")
      .insert({ avatar_id: avatarId, persona_id: personaId, knowledge_source_ids: knowledgeSourceIds })
      .select("id")
      .single();

    if (comboError) throw comboError;

    return NextResponse.json(
      { avatarId, personaId, knowledgeSourceIds, combinationId: comboRow.id },
      { status: 201 }
    );
  } catch (error) {
    for (const undo of cleanup.reverse()) {
      try {
        await undo();
      } catch (cleanupError) {
        console.error("Cleanup step failed during publish rollback:", cleanupError);
      }
    }
    return serverError(error);
  }
}
