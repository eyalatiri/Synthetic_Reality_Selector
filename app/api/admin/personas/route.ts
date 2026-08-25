import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { toPersonaDTO, type PersonaRow } from "@/lib/admin/types";
import { badRequest, serverError, asRecord } from "@/lib/admin/api-utils";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin.from("personas").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json((data as PersonaRow[]).map(toPersonaDTO));
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = asRecord(await req.json());

    const name = body.name;
    if (typeof name !== "string" || !name.trim()) return badRequest("`name` is required");

    const { data, error } = await supabaseAdmin
      .from("personas")
      .insert({
        avatar_id: typeof body.avatarId === "string" ? body.avatarId : null,
        type: typeof body.type === "string" ? body.type : "",
        name,
        prompt: typeof body.prompt === "string" ? body.prompt : "",
        qna_model: typeof body.qnaModel === "string" ? body.qnaModel : "Claude Sonnet",
        creativity: typeof body.creativity === "number" ? body.creativity : 35,
        status: typeof body.status === "string" ? body.status : "Private",
        version: typeof body.version === "string" ? body.version : "v1.0",
        role_title: typeof body.roleTitle === "string" ? body.roleTitle : "",
        department: typeof body.department === "string" ? body.department : "",
        // Drives TTS voice selection - see app/api/conversations/route.ts.
        // Defaults to "female" (matches the DB column default) if omitted.
        gender: body.gender === "male" ? "male" : "female",
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json(toPersonaDTO(data as PersonaRow), { status: 201 });
  } catch (error) {
    return serverError(error);
  }
}
