import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { toConversationDTO, type ConversationRow } from "@/lib/admin/types";
import { asRecord, badRequest, notFound, serverError } from "@/lib/admin/api-utils";
import { resolveSpokenLanguage } from "@/lib/llm/models";

// Next.js 16 route handlers receive `params` as a Promise (must be
// awaited) — see app/api/conversations/[id]/end/route.ts for the same note.
type Params = { params: Promise<{ id: string }> };

// POST /api/conversations/:id/language — called from
// components/chat/ConversationChat.tsx whenever Whisper's per-utterance
// detection (see hooks/useSpeechToText.ts + app/api/stt/route.ts) differs
// from the conversation's current language. Keeps the `language` column
// on the `conversations` table (visible in the Supabase table editor) in
// sync with what the user is actually speaking right now, instead of it
// being frozen at whatever was set when the session started (previously
// always "English" — see app/api/conversations/route.ts's default).
//
// Fire-and-forget from the client — a failed write here doesn't affect
// the current turn's reply, which already used the detected language via
// useChatStream's send() override; this route only affects what gets
// persisted for future turns/reporting.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = asRecord(await req.json());

    const rawLanguage = body.language;
    if (typeof rawLanguage !== "string" || !rawLanguage.trim()) {
      return badRequest("`language` is required");
    }

    // Normalize whatever came in ("french", "fr", "French", ...) to our
    // canonical "English" | "French" | "Arabic" enum before writing it —
    // never trust the client to have already done this.
    const language = resolveSpokenLanguage(rawLanguage);

    const { data, error } = await supabaseAdmin
      .from("conversations")
      .update({ language })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!data) return notFound(`Conversation ${id} not found`);

    return NextResponse.json(toConversationDTO(data as ConversationRow));
  } catch (error) {
    return serverError(error);
  }
}