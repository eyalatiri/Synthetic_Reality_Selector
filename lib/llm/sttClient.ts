import "server-only";
import { STT_MODEL, resolveSttLanguageHint } from "./models";

// Groq's OpenAI-compatible audio transcription endpoint. Same account/
// GROQ_API_KEY as lib/llm/chatClient.ts - Whisper is on Groq's free tier
// (2000 requests/day, no credit card), so no separate signup is needed.
function getEndpoint(): string {
  return "https://api.groq.com/openai/v1/audio/transcriptions";
}

type WhisperSegment = {
  text: string;
  /** Confidence - closer to 0 is better, very negative (e.g. below -1) means low confidence. */
  avg_logprob?: number;
  /** Likelihood this segment is silence/non-speech, 0-1. Groq/Whisper's own signal for "there's nothing really here". */
  no_speech_prob?: number;
  compression_ratio?: number;
};

type WhisperVerboseResponse = {
  text: string;
  language?: string;
  segments?: WhisperSegment[];
};

// Whisper's well-known stock hallucinations on silent/near-silent audio -
// it was trained on subtitled video, so on little-to-no real speech it
// tends to output phrases lifted from that training data (video sign-offs,
// captioner credits) instead of admitting "no speech detected". This list
// is a backstop for cases where the confidence signals below don't catch
// it (short ambient-noise clips sometimes still get a deceptively low
// no_speech_prob). Matched case-insensitively against the trimmed FULL
// transcript, so it won't accidentally eat a real sentence that merely
// contains one of these words.
const HALLUCINATION_PHRASES = [
  "thank you",
  "thanks for watching",
  "thank you for watching",
  "merci",
  "merci d'avoir regardé",
  "sous-titres réalisés par",
  "sous-titrage",
  "subtitles by",
  "amara.org",
  "bye",
  "au revoir",
  "the end",
  "you",
  ".",
  "",
];

function isLikelyHallucination(text: string, segments: WhisperSegment[] | undefined): boolean {
  const trimmed = text.trim();
  const normalized = trimmed.toLowerCase().replace(/[.!?…]+$/g, "").trim();

  if (HALLUCINATION_PHRASES.includes(normalized)) return true;

  if (segments && segments.length > 0) {
    // Average the per-segment signals across the whole clip. High
    // no_speech_prob or very poor avg_logprob means Whisper itself isn't
    // confident there was real speech here, regardless of what text it
    // still produced (models basically never emit "no speech" as text -
    // they output *something*, which is exactly the hallucination risk).
    const avgNoSpeech = segments.reduce((sum, s) => sum + (s.no_speech_prob ?? 0), 0) / segments.length;
    const avgLogprob = segments.reduce((sum, s) => sum + (s.avg_logprob ?? 0), 0) / segments.length;
    if (avgNoSpeech > 0.5) return true;
    if (avgLogprob < -1.0) return true;
  }

  return false;
}

// Below full hallucination-tier confidence, but still shaky enough that
// the detected LANGUAGE specifically shouldn't be trusted (real speech
// probably happened - unlike isLikelyHallucination() - but Whisper was
// clearly straining, which is exactly the "¿Quién es Elisa?" case: a
// genuine French question, badly misheard as Spanish-looking text, with
// a wrong language tag riding along. -0.5 is a deliberately more
// sensitive line than isLikelyHallucination()'s -1.0 - we want to catch
// "confidently wrong" transcripts here, not just "no real audio" ones.
function isLowConfidence(segments: WhisperSegment[] | undefined): boolean {
  if (!segments || segments.length === 0) return true; // no confidence data at all - can't vouch for it
  const avgLogprob = segments.reduce((sum, s) => sum + (s.avg_logprob ?? 0), 0) / segments.length;
  const avgNoSpeech = segments.reduce((sum, s) => sum + (s.no_speech_prob ?? 0), 0) / segments.length;
  return avgLogprob < -0.5 || avgNoSpeech > 0.3;
}

/**
 * Transcribes an audio buffer (recorded user voice message) to text using
 * Groq's hosted whisper-large-v3-turbo. Replaces the previous Azure OpenAI
 * Whisper integration, which needed a paid Azure resource. Handles French,
 * English, and Arabic (including Tunisian Derja - Whisper was trained on
 * enough dialectal/code-switched Arabic to transcribe it reasonably well,
 * though it will render it in Modern Standard Arabic script rather than
 * a phonetic Derja spelling).
 *
 * Returns the detected spoken language alongside the text (Whisper's raw
 * language name, e.g. "english"/"french"/"arabic" - see
 * app/api/stt/route.ts, which normalizes it via resolveSpokenLanguage()).
 *
 * IMPORTANT: filters out likely Whisper hallucinations before returning.
 * hooks/useSpeechToText.ts intentionally sends any non-trivial recorded
 * blob (see that file's docstring for why the old client-side RMS gate
 * was removed) - which means near-silent/ambient-noise clips now reach
 * Whisper, and Whisper reliably hallucinates stock phrases like
 * "Thank you." on those instead of returning nothing. Left unfiltered,
 * that hallucinated text used to get treated as a real user message
 * (wrong chat replies) AND its (wrong) detected language used to
 * overwrite the conversation's real language via the auto-switch logic
 * in ConversationChat.tsx. See isLikelyHallucination() above - uses
 * Groq's own per-segment no_speech_prob/avg_logprob plus a denylist of
 * Whisper's known stock hallucination phrases. A filtered-out result
 * returns text: "" (language omitted), which the caller's existing
 * `if (trimmed) ...` check already treats as "nothing to do here".
 *
 * Also returns `needsRepeat: true` for a real (non-hallucinated) but
 * low-confidence transcript - e.g. a genuine French question badly
 * misheard as Spanish-looking gibberish, with a confidently-wrong
 * language tag riding along (see isLowConfidence() above). Unlike a
 * hallucination, real speech probably happened here, so we still return
 * the (unreliable) text for logging/context, but omit `language`
 * entirely so a shaky guess can never lock the conversation onto the
 * wrong language - see ConversationChat.tsx, which surfaces
 * `needsRepeat` by asking the user to say it again instead of silently
 * sending the garbled text to the model.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  opts?: {
    filename?: string;
    mimeType?: string;
    /**
     * Optional language hint. Deliberately NOT sent by default (see
     * hooks/useSpeechToText.ts) - forcing a hint biases Whisper toward
     * that language on every request, which defeats detecting a switch.
     * Only pass this if you specifically want to bias a known-language
     * segment (e.g. re-transcribing after a detection you already trust).
     */
    language?: string;
  }
): Promise<{ text: string; language?: string; needsRepeat?: boolean }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing GROQ_API_KEY in .env.local");

  const url = getEndpoint();
  const filename = opts?.filename ?? "audio.webm";
  const mimeType = opts?.mimeType ?? "audio/webm";

  // Node's Buffer type isn't directly assignable to the DOM BlobPart type
  // (TS2322 - Buffer<ArrayBufferLike> vs ArrayBufferView<ArrayBuffer>).
  // Wrapping in a fresh Uint8Array normalizes it to a plain
  // ArrayBuffer-backed view that Blob's constructor accepts cleanly.
  const bytes = new Uint8Array(audioBuffer);
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mimeType }), filename);
  form.append("model", STT_MODEL);
  // verbose_json - needed for both the detected `language` field AND the
  // per-segment no_speech_prob/avg_logprob hallucination signals used
  // below. Plain "json" only ever returns `text`, with no way to tell a
  // real (if short) utterance apart from a confident-sounding hallucination.
  form.append("response_format", "verbose_json");
  // Deterministic decoding - reduces (doesn't eliminate) hallucination
  // variance run-to-run, and matches Groq's own docs example.
  form.append("temperature", "0");
  if (opts?.language) form.append("language", resolveSttLanguageHint(opts.language));

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Transcription request failed (${res.status}) URL=${url} Response=${text}`);
  }

  const json = (await res.json()) as WhisperVerboseResponse;

  const hallucinated = isLikelyHallucination(json.text ?? "", json.segments);
  if (hallucinated) {
    const avgNoSpeech = json.segments?.length
      ? json.segments.reduce((sum, s) => sum + (s.no_speech_prob ?? 0), 0) / json.segments.length
      : undefined;
    console.log(
      `[stt-debug] discarded likely hallucination: text="${json.text}" avgNoSpeechProb=${avgNoSpeech}`
    );
    return { text: "", language: undefined };
  }

  if (isLowConfidence(json.segments)) {
    console.log(`[stt-debug] low confidence transcript, asking user to repeat: text="${json.text}"`);
    return { text: json.text, language: undefined, needsRepeat: true };
  }

  return { text: json.text, language: json.language };
}