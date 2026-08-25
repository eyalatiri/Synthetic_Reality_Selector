import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { toPersonaDTO, type PersonaRow } from "@/lib/admin/types";
import { asRecord, notFound, serverError } from "@/lib/admin/api-utils";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { data, error } = await supabaseAdmin.from("personas").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return notFound(`Persona ${id} not found`);
    return NextResponse.json(toPersonaDTO(data as PersonaRow));
  } catch (error) {
    return serverError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = asRecord(await req.json());

    const patch: Record<string, unknown> = {};
    const stringFields = ["type", "name", "prompt", "roleTitle", "department", "version"] as const;
    const stringColumns: Record<(typeof stringFields)[number], string> = {
      type: "type",
      name: "name",
      prompt: "prompt",
      roleTitle: "role_title",
      department: "department",
      version: "version",
    };
    for (const field of stringFields) {
      if (typeof body[field] === "string") patch[stringColumns[field]] = body[field];
    }

    if (["Claude Opus", "Claude Sonnet", "Claude Haiku"].includes(body.qnaModel as string)) {
      patch.qna_model = body.qnaModel;
    }
    if (["Private", "Public", "Archived"].includes(body.status as string)) {
      patch.status = body.status;
    }
    if (typeof body.avatarId === "string" || body.avatarId === null) {
      patch.avatar_id = body.avatarId;
    }
    if (typeof body.creativity === "number" && body.creativity >= 0 && body.creativity <= 100) {
      patch.creativity = body.creativity;
    }
    // Drives TTS voice selection - see app/api/conversations/route.ts and
    // supabase/migrations/0004_persona_gender.sql.
    if (body.gender === "male" || body.gender === "female") {
      patch.gender = body.gender;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("personas")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!data) return notFound(`Persona ${id} not found`);

    return NextResponse.json(toPersonaDTO(data as PersonaRow));
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { error, count } = await supabaseAdmin.from("personas").delete({ count: "exact" }).eq("id", id);
    if (error) throw error;
    if (!count) return notFound(`Persona ${id} not found`);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return serverError(error);
  }
}
