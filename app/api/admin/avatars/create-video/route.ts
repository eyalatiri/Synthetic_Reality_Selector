import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { badRequest, serverError } from "@/lib/admin/api-utils";
import { AVATAR_VIDEO_LIMITS } from "@/lib/avatar/validateVideo";

// POST /api/admin/avatars/create-video — called from StepAvatar.tsx and
// AvatarVideoUpload.tsx as soon as the admin picks a source video.
//
// MuseTalk is audio-driven: it can't produce anything until there is a
// reply to speak, so avatar CREATION no longer calls it (or any GPU
// service) at all. The uploaded clip simply *is* the avatar:
//   - in the browser it plays muted on a loop as the idle animation, and
//   - at conversation time /api/avatar/lip-sync sends it to MuseTalk
//     together with each reply's audio.
// Consequence: creating an avatar works even when the Kaggle notebook is
// off, and takes seconds instead of minutes.
//
// Same request/response contract as before (multipart `source_video` ->
// { videoUrl, storagePath }), so the two upload components only needed
// their copy and a client-side validation step changed.
//
// Requires a PUBLIC Supabase Storage bucket named "avatars" (unchanged).

const STORAGE_BUCKET = "avatars";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("source_video");
    if (!(file instanceof File)) {
      return badRequest("`source_video` is required (multipart/form-data)");
    }
    if (!file.type.startsWith("video/")) return badRequest("`source_video` must be a video file");
    if (file.size === 0) return badRequest("`source_video` is empty");
    if (file.size > AVATAR_VIDEO_LIMITS.maxBytes) {
      return badRequest(`Video is too large (limit ${AVATAR_VIDEO_LIMITS.maxBytes / 1e6} MB)`);
    }

    // Name by UUID only: the URL is the cache key in lib/musetalk/client.ts,
    // so a re-upload must always produce a fresh URL, and user-supplied file
    // names never reach the storage path.
    const ext = (/\.([a-z0-9]{2,4})$/i.exec(file.name)?.[1] ?? "mp4").toLowerCase();
    const storagePath = `${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, new Uint8Array(await file.arrayBuffer()), {
        contentType: file.type || "video/mp4",
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabaseAdmin.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);

    return NextResponse.json({ videoUrl: publicUrlData.publicUrl, storagePath }, { status: 201 });
  } catch (error) {
    return serverError(error);
  }
}
