import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { toAvatarDTO, type AvatarRow } from "@/lib/admin/types";
import { asRecord, notFound, serverError } from "@/lib/admin/api-utils";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { data, error } = await supabaseAdmin.from("avatars").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return notFound(`Avatar ${id} not found`);
    return NextResponse.json(toAvatarDTO(data as AvatarRow));
  } catch (error) {
    return serverError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = asRecord(await req.json());

    const patch: Record<string, unknown> = {};
    if (typeof body.name === "string") patch.name = body.name;
    if (typeof body.owner === "string") patch.owner = body.owner;
    if (typeof body.imageUrl === "string" || body.imageUrl === null) patch.image_url = body.imageUrl;
    if (body.ownerType === "Organisation" || body.ownerType === "Individual") patch.owner_type = body.ownerType;
    if (["Full body", "Half body", "Head only"].includes(body.bodyType as string)) {
      patch.body_type = body.bodyType;
    }
    if (["Private", "Public", "Archived"].includes(body.status as string)) {
      patch.status = body.status;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("avatars")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!data) return notFound(`Avatar ${id} not found`);

    return NextResponse.json(toAvatarDTO(data as AvatarRow));
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { error, count } = await supabaseAdmin.from("avatars").delete({ count: "exact" }).eq("id", id);
    if (error) throw error;
    if (!count) return notFound(`Avatar ${id} not found`);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return serverError(error);
  }
}
