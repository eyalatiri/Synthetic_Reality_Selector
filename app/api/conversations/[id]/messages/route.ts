import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { notFound, serverError } from "@/lib/admin/api-utils";

type Params = { params: Promise<{ id: string }> };

type ConversationMessageRow = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

// GET /api/conversations/:id/messages — the read side of the transcript
// logging lib/llm/chatPipeline.ts writes on every turn (conversation_messages
// table, see supabase/migrations/0003_conversation_messages.sql). Returns an
// empty array (not a 404) if the migration hasn't been run yet or nothing's
// been logged for this session — a missing table is a setup gap, not this
// conversation not existing.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    const { data: conversation, error: conversationError } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (conversationError) throw conversationError;
    if (!conversation) return notFound(`Conversation ${id} not found`);

    const { data, error } = await supabaseAdmin
      .from("conversation_messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to read conversation_messages (migration 0003 not run?):", error);
      return NextResponse.json([]);
    }

    const messages = (data as ConversationMessageRow[]).map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      createdAt: row.created_at,
    }));

    return NextResponse.json(messages);
  } catch (error) {
    return serverError(error);
  }
}
