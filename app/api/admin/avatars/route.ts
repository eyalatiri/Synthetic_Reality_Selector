import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { toAvatarDTO, type AvatarRow } from "@/lib/admin/types";
import { badRequest, serverError, asRecord } from "@/lib/admin/api-utils";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin.from("avatars").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json((data as AvatarRow[]).map(toAvatarDTO));
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = asRecord(await req.json());

    const name = body.name;
    const owner = body.owner;
    const ownerType = body.ownerType;
    const bodyType = body.bodyType;

    if (typeof name !== "string" || !name.trim()) return badRequest("`name` is required");
    if (typeof owner !== "string" || !owner.trim()) return badRequest("`owner` is required");
    if (ownerType !== "Organisation" && ownerType !== "Individual") {
      return badRequest("`ownerType` must be 'Organisation' or 'Individual'");
    }
    if (bodyType !== "Full body" && bodyType !== "Half body" && bodyType !== "Head only") {
      return badRequest("`bodyType` must be 'Full body', 'Half body', or 'Head only'");
    }

    const { data, error } = await supabaseAdmin
      .from("avatars")
      .insert({
        name,
        owner,
        owner_type: ownerType,
        body_type: bodyType,
        image_url: typeof body.imageUrl === "string" ? body.imageUrl : null,
        video_url: typeof body.videoUrl === "string" ? body.videoUrl : null, // ← ADD
        // Fixed default: "Draft" isn't a valid PublishState, so new rows
        // rendered with a red/danger badge instead of neutral.
        status: typeof body.status === "string" ? body.status : "Private",
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json(toAvatarDTO(data as AvatarRow), { status: 201 });
  } catch (error) {
    return serverError(error);
  }
}
