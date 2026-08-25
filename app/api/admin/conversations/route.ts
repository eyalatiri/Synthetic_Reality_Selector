import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { toConversationDTO, type ConversationRow } from "@/lib/admin/types";
import { serverError } from "@/lib/admin/api-utils";

// GET /api/admin/conversations — for the /admin/conversations "Conversation
// center" page once it gets a real design. Session content (transcript,
// messages) is the AI part and isn't modeled here — this is just the
// session-level metadata table already used by lib/admin/mock-data.ts.
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("conversations")
      .select("*")
      .order("started_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json((data as ConversationRow[]).map(toConversationDTO));
  } catch (error) {
    return serverError(error);
  }
}
