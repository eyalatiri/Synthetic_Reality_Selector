import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { toConversationDTO, type ConversationRow } from "@/lib/admin/types";
import { asRecord, notFound, serverError } from "@/lib/admin/api-utils";

// Next.js 16 route handlers receive `params` as a Promise (must be
// awaited) — this was previously accessed synchronously here, which meant
// `params.id` was `undefined` and every call 404'd. `await`-ing a plain
// object still just returns it unchanged, so this is safe either way.
type Params = { params: Promise<{ id: string }> };

// POST /api/conversations/:id/end — called from the "End session" (X) button
// in VoiceConversationScreen's onEndSession handler (wired up by
// components/chat/ConversationChat.tsx). Only closes out the session row;
// it does not touch or save the transcript itself — that's handled by
// lib/llm/chatPipeline.ts writing to conversation_messages per turn.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = asRecord(await req.json().catch(() => ({})));

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("conversations")
      .select("started_at")
      .eq("id", id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return notFound(`Conversation ${id} not found`);

    const startedAt = new Date(existing.started_at as string).getTime();
    const endedAt = Date.now();
    const durationSeconds =
      typeof body.durationSeconds === "number" ? body.durationSeconds : Math.round((endedAt - startedAt) / 1000);

    const status = body.status === "Escalated" ? "Escalated" : "Resolved";

    const { data, error } = await supabaseAdmin
      .from("conversations")
      .update({
        status,
        ended_at: new Date(endedAt).toISOString(),
        duration_seconds: durationSeconds,
      })
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
