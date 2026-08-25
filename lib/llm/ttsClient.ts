import "server-only";
import { Communicate } from "edge-tts-universal";
import { resolveTtsVoice } from "./models";

/**
 * Converts text to speech using Microsoft Edge's free read-aloud service
 * (via the `edge-tts-universal` npm package - server-side Node/WebSocket
 * client, no API key, no billing, unlimited use). Replaces the previous
 * Azure OpenAI gpt-4o-mini-tts integration, which required a paid Azure
 * resource and only spoke whatever language the text happened to be in
 * with a fixed voice name.
 *
 * Unlike the old implementation, language is NOT auto-detected from the
 * text - Edge TTS voices are locale-specific (e.g. fr-FR, ar-TN), so the
 * caller must say which language/persona-gender to use. See
 * resolveTtsVoice() in ./models and app/api/conversations/route.ts, which
 * threads persona.gender + conversation.language through to here.
 */
export async function synthesizeSpeech(
  text: string,
  opts?: {
    /** Explicit Edge voice name (e.g. "fr-FR-VivienneMultilingualNeural"). Takes priority over gender/language. */
    voice?: string;
    /** Used with `language` to resolve a voice when `voice` isn't given. */
    gender?: "female" | "male";
    /** Conversation language ("English" | "French" | "Arabic") - see models.ts#resolveSpokenLanguage. */
    language?: string;
    rate?: string; // e.g. "+0%"
    pitch?: string; // e.g. "+0Hz"
  }
): Promise<Buffer> {
  const voice = opts?.voice || resolveTtsVoice(opts?.gender, opts?.language);

  const communicate = new Communicate(text, {
    voice,
    rate: opts?.rate ?? "+0%",
    pitch: opts?.pitch ?? "+0Hz",
  });

  const chunks: Buffer[] = [];
  for await (const chunk of communicate.stream()) {
    if (chunk.type === "audio" && chunk.data) {
      chunks.push(Buffer.from(chunk.data));
    }
  }

  if (chunks.length === 0) {
    throw new Error(`Edge TTS returned no audio for voice="${voice}"`);
  }

  return Buffer.concat(chunks);
}