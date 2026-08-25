import { NextRequest, NextResponse } from "next/server";
import { synthesizeSpeech } from "@/lib/llm/ttsClient";

// POST /api/tts - thin wrapper around synthesizeSpeech() so the browser
// plays real generated audio instead of relying on the OS's installed
// SpeechSynthesis voices (see hooks/useTextToSpeech.ts's rewrite - the
// old browser-based approach had no reliable language or gender mapping,
// which is why French replies were playing back in English with a random
// male voice).
//
// Backed by Microsoft Edge TTS (free, no API key - see lib/llm/ttsClient.ts)
// instead of the old Azure OpenAI gpt-4o-mini-tts integration. Accepts
// either an explicit `voice` (Edge voice name) OR `gender` + `language`,
// which get resolved to a voice server-side via resolveTtsVoice().
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return NextResponse.json({ error: "`text` is required" }, { status: 400 });

    const voice = typeof body.voice === "string" ? body.voice : undefined;
    const gender = body.gender === "male" || body.gender === "female" ? body.gender : undefined;
    const language = typeof body.language === "string" ? body.language : undefined;

    const audioBuffer = await synthesizeSpeech(text, { voice, gender, language });

    // NextResponse's body type is DOM's BodyInit, which a Node Buffer
    // doesn't structurally satisfy in newer @types/node (TS2345 - same
    // issue sttClient.ts already works around when building its
    // FormData). Wrapping in a plain Uint8Array normalizes it to a type
    // BodyInit accepts.
    return new NextResponse(new Uint8Array(audioBuffer), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("TTS route error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "TTS failed" }, { status: 500 });
  }
}