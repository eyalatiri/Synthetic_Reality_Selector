// lib/llm/models.ts
import type { QnaModel } from "@/lib/admin/types";

// Conversational replies should stay short (see buildSystemPrompt) - this
// is a ceiling, not a target, mostly there to bound latency/cost per turn.
export const DEFAULT_MAX_TOKENS = 1024;


const CHAT_MODEL_MAP: Record<QnaModel, string> = {
  "Claude Opus": process.env.CHAT_MODEL_QUALITY || "openai/gpt-oss-120b",
  "Claude Sonnet": process.env.CHAT_MODEL_BALANCED || "openai/gpt-oss-120b",
  "Claude Haiku": process.env.CHAT_MODEL_FAST || "openai/gpt-oss-20b",
};

const DEFAULT_QNA_MODEL: QnaModel = "Claude Sonnet";

export function resolveModelId(qnaModel: string | null | undefined): string {
  if (qnaModel && qnaModel in CHAT_MODEL_MAP) return CHAT_MODEL_MAP[qnaModel as QnaModel];
  return CHAT_MODEL_MAP[DEFAULT_QNA_MODEL];
}

// ---- Audio models (STT / TTS) -------------------------------------------
// Both providers below are free with no credit card required:
//  - STT: Groq's hosted Whisper (whisper-large-v3-turbo) - free tier,
//    2000 requests/day, sign up with just an email at console.groq.com.
//    Uses the same GROQ_API_KEY already used for chat (see chatClient.ts).
//  - TTS: Microsoft Edge's read-aloud service via the `edge-tts-universal`
//    npm package (see lib/llm/ttsClient.ts) - no API key at all, unlimited,
//    runs server-side only (Node websocket, not callable from the browser).
export const STT_MODEL = process.env.STT_MODEL || "whisper-large-v3-turbo";

// ---- Supported spoken languages ------------------------------------------
// Matches conversations.language ("English" | "French" | "Arabic") and the
// STT language hint we pass Groq. "Arabic" here resolves to Tunisian Arabic
// (Derja) voices for TTS - ar-TN is the closest real Edge voice to Darija,
// and naturally code-switches with French, which fits how Tunisians
// actually speak. MSA (ar-SA) voices sound noticeably more formal/foreign.
export type SpokenLanguage = "English" | "French" | "Arabic";

export function resolveSpokenLanguage(language: string | null | undefined): SpokenLanguage {
  const normalized = (language || "").trim().toLowerCase();
  if (normalized.startsWith("fr")) return "French";
  if (normalized.startsWith("ar") || normalized.includes("darija") || normalized.includes("tunis")) return "Arabic";
  return "English";
}

/**
 * Strict counterpart to resolveSpokenLanguage() - used specifically for
 * classifying Whisper's *detected* language (see app/api/stt/route.ts),
 * where silently folding an unsupported language into "English" is
 * actively wrong: it was causing e.g. Spanish speech ("¿Quién es Elisa?")
 * to get labeled language="English" and the reply locked to English
 * with no indication anything was actually unrecognized. Returns
 * undefined for anything that isn't clearly English/French/Arabic, so
 * the caller can ask the user to try again instead of guessing.
 * resolveSpokenLanguage() itself stays lenient (defaults to English) for
 * its other call sites (STT hint resolution, TTS voice selection), where
 * a hint/fallback and an "I couldn't tell" signal are different things.
 */
const ENGLISH_LANGUAGE_NAMES = ["english", "en"];
export function resolveSpokenLanguageStrict(language: string | null | undefined): SpokenLanguage | undefined {
  const normalized = (language || "").trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized.startsWith("fr")) return "French";
  if (normalized.startsWith("ar") || normalized.includes("darija") || normalized.includes("tunis")) return "Arabic";
  if (ENGLISH_LANGUAGE_NAMES.includes(normalized)) return "English";
  return undefined;
}

// Groq Whisper language hint (ISO-639-1). Omitting this lets Whisper
// auto-detect, but passing it improves accuracy/latency when we already
// know which language the conversation is in.
const STT_LANGUAGE_HINT: Record<SpokenLanguage, string> = {
  English: "en",
  French: "fr",
  Arabic: "ar",
};

export function resolveSttLanguageHint(language: string | null | undefined): string {
  return STT_LANGUAGE_HINT[resolveSpokenLanguage(language)];
}

// ---- Edge TTS voice map ----------------------------------------------
// One female + one male neural voice per supported language. All are
// free Microsoft Edge voices with no API key. ar-TN-* are the Tunisian
// Arabic (Derja) voices - see lib/llm/ttsClient.ts for the synth call.
const EDGE_VOICE_MAP: Record<SpokenLanguage, { female: string; male: string }> = {
  English: {
    female: process.env.TTS_VOICE_EN_FEMALE || "en-US-AvaMultilingualNeural",
    male: process.env.TTS_VOICE_EN_MALE || "en-US-AndrewMultilingualNeural",
  },
  French: {
    female: process.env.TTS_VOICE_FR_FEMALE || "fr-FR-VivienneMultilingualNeural",
    male: process.env.TTS_VOICE_FR_MALE || "fr-FR-RemyMultilingualNeural",
  },
  Arabic: {
    female: process.env.TTS_VOICE_AR_FEMALE || "ar-TN-ReemNeural",
    male: process.env.TTS_VOICE_AR_MALE || "ar-TN-HediNeural",
  },
};

/**
 * Resolves an Edge TTS voice name from a persona's gender + the
 * conversation's spoken language. Replaces the old flat
 * TTS_VOICE_FEMALE/TTS_VOICE_MALE OpenAI voice names, which had no
 * language dimension at all (see app/api/conversations/route.ts for the
 * call site - now passes `language` through too).
 */
export function resolveTtsVoice(
  gender: "female" | "male" | null | undefined,
  language: string | null | undefined
): string {
  const lang = resolveSpokenLanguage(language);
  const g = gender === "male" ? "male" : "female";
  return EDGE_VOICE_MAP[lang][g];
}