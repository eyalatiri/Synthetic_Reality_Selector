"use client";

import { useCallback, useRef, useState } from "react";

export type TtsPersonaVoice = {
  /** Explicit Edge TTS voice name (e.g. "fr-FR-VivienneMultilingualNeural"). Overrides gender/language when set. */
  voice?: string;
  /** Persona's gender - combined with `language` server-side to pick a free Edge voice. See app/api/conversations/route.ts + lib/llm/models.ts#resolveTtsVoice. */
  gender?: "female" | "male";
  /** Conversation language ("English" | "French" | "Arabic") - see lib/llm/models.ts#resolveSpokenLanguage. */
  language?: string;
};

/**
 * Speaks text using our backend /api/tts route (free Microsoft Edge TTS,
 * see lib/llm/ttsClient.ts) instead of the browser's native
 * SpeechSynthesis API (see git history for the previous implementation,
 * backed by lib/tts/voiceMapping.ts - now unused/deletable). Fixes two
 * bugs the browser approach had no way to solve: (1) language always
 * matched whatever the OS's default voice was, regardless of the actual
 * reply's language — French/Arabic replies played back in English; (2) no
 * reliable gender mapping — random/default voice regardless of the
 * persona. Unlike the old Azure integration, Edge TTS voices are
 * locale-specific, so we pass `gender` + `language` explicitly rather
 * than relying on auto-detection from the text.
 */
export function useTextToSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentUrlRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    audioRef.current = null;
    if (currentUrlRef.current) {
      URL.revokeObjectURL(currentUrlRef.current);
      currentUrlRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(
    async (text: string, persona: TtsPersonaVoice) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      stop(); // a new reply always interrupts whatever's currently playing
      setError(null);
      const requestId = ++requestIdRef.current;

      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: trimmed,
            voice: persona.voice,
            gender: persona.gender,
            language: persona.language,
          }),
        });

        if (!res.ok) throw new Error(`TTS request failed (${res.status})`);
        // A newer speak() call superseded this one while we were waiting -
        // drop this response instead of playing stale/out-of-order audio.
        if (requestId !== requestIdRef.current) return;

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        currentUrlRef.current = url;

        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onplay = () => setIsSpeaking(true);
        audio.onended = () => setIsSpeaking(false);
        audio.onerror = () => {
          setError("Playback failed");
          setIsSpeaking(false);
        };

        await audio.play();
      } catch (err) {
        if (requestId === requestIdRef.current) {
          setIsSpeaking(false);
          setError(err instanceof Error ? err.message : "Failed to speak reply");
        }
      }
    },
    [stop]
  );

  // Always "supported" - unlike SpeechSynthesis, every modern browser can
  // play back an <audio> element from a fetched blob.
  return { speak, stop, isSpeaking, isSupported: true, error };
}