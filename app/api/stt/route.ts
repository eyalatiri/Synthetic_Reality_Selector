import { NextRequest, NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/llm/sttClient";
import { resolveSpokenLanguageStrict } from "@/lib/llm/models";

// POST /api/stt - transcribes a recorded audio clip to text via Groq's
// free Whisper (whisper-large-v3-turbo, see lib/llm/sttClient.ts). This
// route did not exist before - the frontend was instead using the
// browser's built-in Web Speech API (hooks/useSpeechToText.ts), which is
// Chrome/Edge-only and has weak-to-nonexistent Arabic dialect support.
// This route lets the client send real recorded audio (e.g. from
// MediaRecorder) and get back accurate French/English/Arabic text,
// including Tunisian Derja, from anywhere Whisper can reach - not just
// browsers that ship a speech engine.
//
// Expects multipart/form-data with:
//   - `audio`: the recorded clip (webm/ogg/mp3/wav...)
//   - `language` (optional): only pass this if you deliberately want to
//     bias Whisper toward a known language. Left unset by default (see
//     useSpeechToText.ts) so every utterance is freely auto-detected -
//     that's what lets the app notice the user switched languages.
//
// Returns `{ text, language }` - `language` is Whisper's raw detection
// normalized to our "English" | "French" | "Arabic" enum via
// resolveSpokenLanguageStrict(), so the caller can lock the LLM reply
// language and pick the matching TTS voice for this exact turn.
// Deliberately the STRICT resolver, not resolveSpokenLanguage() - a
// language we don't support (Spanish, etc.) must come back as `language:
// undefined` here so the client can ask the user to try again, rather
// than being silently folded into "English" (see
// components/chat/ConversationChat.tsx's handling of an undefined
// detection - it re-prompts instead of guessing).
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("audio");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "`audio` file is required" }, { status: 400 });
    }

    const language = typeof form.get("language") === "string" ? (form.get("language") as string) : undefined;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const filename = file instanceof File && file.name ? file.name : "audio.webm";
    const mimeType = file.type || "audio/webm";

    const { text, language: detected } = await transcribeAudio(buffer, { filename, mimeType, language });

    const resolvedLanguage = detected ? resolveSpokenLanguageStrict(detected) : undefined;
    // Whisper *did* detect something, and it's not empty/hallucination-
    // filtered (transcribeAudio already returns text:"" for those - see
    // sttClient.ts), but it's a language we don't support (Spanish,
    // German, etc.) - resolvedLanguage is undefined in that case, which
    // used to get silently treated as "keep whatever language we had"
    // and folded into English. Distinguish that from "detection was
    // simply inconclusive for an otherwise-fine segment" (rare, but
    // possible) so the client can tell the user to repeat themselves in
    // a supported language instead of guessing.
    const needsRepeat = Boolean(text?.trim()) && Boolean(detected) && !resolvedLanguage;

    return NextResponse.json({ text, language: resolvedLanguage, needsRepeat });
  } catch (error) {
    console.error("STT route error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Transcription failed" }, { status: 500 });
  }
}