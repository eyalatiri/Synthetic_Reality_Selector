import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { lipSync, MusetalkError } from "@/lib/musetalk/client";
import { badRequest, notFound, serverError } from "@/lib/admin/api-utils";

export const runtime = "nodejs";
// MuseTalk on a Kaggle T4 can take minutes per reply. Only matters on hosts
// that enforce a function timeout (e.g. Vercel); `next dev` ignores it.
export const maxDuration = 300;

const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

// POST /api/avatar/lip-sync — called by hooks/useAvatarSpeech.ts once per
// assistant reply (or per sentence if chunking is on).
//
// multipart/form-data:
//   - audio:    the TTS clip for this reply (from /api/tts)
//   - avatarId: which avatar's source video to drive
//
// The client sends an avatar *id*, never a video URL: the server looks the
// URL up itself, so a caller can't make this route fetch arbitrary URLs and
// an admin replacing an avatar's video takes effect immediately.
//
// Returns video/mp4 on success. 503 = MuseTalk not configured/unreachable
// (the client falls back to voice-only and stops retrying for a while),
// 502 = MuseTalk reached but the job failed.
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const audio = form.get("audio");
    const avatarId = form.get("avatarId");

    if (!(audio instanceof Blob) || audio.size === 0) return badRequest("`audio` is required");
    if (audio.size > MAX_AUDIO_BYTES) return badRequest("`audio` is too large");
    if (typeof avatarId !== "string" || !avatarId) return badRequest("`avatarId` is required");

    const { data: avatar, error } = await supabaseAdmin
      .from("avatars")
      .select("video_url")
      .eq("id", avatarId)
      .maybeSingle();
    if (error) throw error;
    if (!avatar) return notFound(`Avatar ${avatarId} not found`);
    if (!avatar.video_url) return badRequest("This avatar has no source video");

    const t0 = Date.now();
    console.log(`[lip-sync] start avatar=${avatarId} audio=${(audio.size / 1024).toFixed(0)}KB`);
    const mp4 = await lipSync(avatar.video_url as string, audio);
    console.log(`[lip-sync] ok in ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${(mp4.byteLength / 1024).toFixed(0)}KB mp4`);

    return new NextResponse(mp4, {
      status: 200,
      headers: { "Content-Type": "video/mp4", "Cache-Control": "no-store" },
    });
  } catch (err) {
    if (err instanceof MusetalkError) {
      console.error(`[lip-sync] FAILED (${err.kind}):`, err.message);
      const status = err.kind === "failed" ? 502 : 503;
      return NextResponse.json({ error: err.message, kind: err.kind }, { status });
    }
    return serverError(err);
  }
}
