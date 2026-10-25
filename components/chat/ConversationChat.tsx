"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import VoiceConversationScreen from "@/components/voice/VoiceConversationScreen";
import { useChatStream } from "@/hooks/useChatStream";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { useAvatarSpeech } from "@/hooks/useAvatarSpeech";
import type { TtsPersonaVoice } from "@/hooks/useTextToSpeech";
import { AvatarStage } from "@/components/avatar/AvatarStage";

type ScreenProps = {
  brandName: string;
  assistantName: string;
  assistantRole: string;
  /** "English" | "French" | "Arabic" - drives both TTS voice and STT language hint. */
  language?: string;
  voice?: TtsPersonaVoice;
  /** Idle-loop video + whether MuseTalk answered /health when the conversation started. See app/api/conversations/route.ts. */
  avatar?: {
    id: string;
    name: string;
    imageUrl: string | null;
    videoUrl: string | null;
    lipSync: boolean;
  } | null;
};

// French function words/diacritics that essentially never appear in
// English sentences of similar length - cheap enough to run on every
// typed message without a network round-trip, and only needs to be
// roughly right (see handleSendText's comment for why a wrong guess is
// low-stakes and self-corrects on the next message).
const FRENCH_MARKERS =
  /[éèêëàâîïôûùüç]|(?:^|\s)(le|la|les|un|une|des|du|de|et|est|c'est|je|tu|vous|nous|qui|que|où|pourquoi|comment|bonjour|merci|s'il)\b/i;

// English function words that don't overlap with the French list above -
// same "cheap heuristic, not a real classifier" caveat applies.
const ENGLISH_MARKERS =
  /(?:^|\s)(the|is|are|what|why|how|who|when|hello|hi|thanks|thank you|please|can|could|would|do|does)\b/i;

/**
 * Best-effort language guess for typed text. Voice input gets real
 * detection from Whisper (see hooks/useSpeechToText.ts) - typed text has
 * no equivalent server round-trip, so this is a fast local guess instead:
 * Arabic script detection via Unicode range is essentially exact; French
 * vs. English is a cheap stopword/diacritic heuristic, not a real
 * language-ID model. This is what was missing before - the text input
 * went straight to send() with no language detection at all, which is
 * why typed French/Arabic kept getting English replies regardless of
 * what the conversation's language was previously set to.
 */
function detectTypedLanguage(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  if (/[\u0600-\u06FF]/.test(trimmed)) return "Arabic";
  if (FRENCH_MARKERS.test(trimmed)) return "French";
  if (ENGLISH_MARKERS.test(trimmed)) return "English";
  // No strong signal either way (e.g. very short input like "ok", or a
  // proper noun) - don't guess, just leave the language wherever it
  // already was rather than risk an unwarranted switch.
  return undefined;
}

function repeatPromptFor(language: string | undefined): string {
  switch (language) {
    case "French":
      return "Désolé, je n'ai pas bien compris — pouvez-vous répéter s'il vous plaît ?";
    case "Arabic":
      return "عذرًا، لم أفهم جيدًا — هل يمكنك الإعادة من فضلك؟";
    default:
      return "Sorry, I didn't quite catch that — could you say it again?";
  }
}

export function ConversationChat({
  avatarId,
  personaId,
  combinationId,
  language,
}: {
  avatarId?: string;
  personaId?: string;
  combinationId?: string;
  /** "English" | "French" | "Arabic" — the employee's pick from AvatarPicker's language toggle. Sent when creating the conversation row so conversations.language reflects it instead of always defaulting to English. */
  language?: string;
}) {
  const router = useRouter();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [screenProps, setScreenProps] = useState<ScreenProps | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  // Set when STT comes back too low-confidence to trust (see
  // lib/llm/sttClient.ts's isLowConfidence()) - shown in place of the
  // normal transcript instead of silently sending garbled text (with a
  // likely-wrong language tag) to the model. Cleared on the next
  // successful send.
  const [repeatPrompt, setRepeatPrompt] = useState<string | null>(null);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!personaId || startedRef.current) return;
    startedRef.current = true;

    fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personaId,
        avatarId,
        combinationId,
        conversationType: "Voice",
        creatorUser: "employee",
        language,
      }),
    })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Failed to start conversation");
        return body as { conversation: { id: string }; screenProps: ScreenProps };
      })
      .then(({ conversation, screenProps }) => {
        setConversationId(conversation.id);
        setScreenProps(screenProps);
      })
      .catch((err) => setSetupError(err instanceof Error ? err.message : "Failed to start conversation"));
  }, [personaId, combinationId]);

  useEffect(() => {
    if (!conversationId) return;
    const interval = setInterval(() => setSessionSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [conversationId]);

  const { messages, streamingText, isStreaming, escalated, send, error: chatError } = useChatStream(
    personaId
      ? { mode: "persisted", personaId, avatarId, combinationId, conversationId, language: screenProps?.language }
      : { mode: "preview", avatarName: "Avatar", personaOverride: {}, knowledgeSourceIds: [] }
  );

  // ---- Live spoken language -------------------------------------------
  // Starts at whatever the conversation was created with (screenProps.language,
  // e.g. "English"), but updates the moment STT detects the user speaking a
  // different language — see onFinalTranscript below. A ref (not state) so
  // the very same turn that detects a switch can use it immediately via
  // send()'s languageOverride, without waiting a render cycle. See
  // hooks/useChatStream.ts + hooks/useSpeechToText.ts + app/api/stt/route.ts.
  const activeLanguageRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (screenProps?.language && !activeLanguageRef.current) {
      activeLanguageRef.current = screenProps.language;
    }
  }, [screenProps]);

  // Persists a language switch to Supabase (conversations.language) and
  // updates the ref every future turn/TTS call reads from. Shared by both
  // the STT path (Whisper's detection, confirmed working) and the typed-
  // text path (local heuristic detection, added below) — previously only
  // STT had this, which is why typing French/Arabic kept getting English
  // replies: nothing about the text-input path ever looked at what
  // language was typed.
  const applyDetectedLanguage = useCallback(
    (detectedLanguage: string | undefined) => {
      if (!detectedLanguage || detectedLanguage === activeLanguageRef.current) return;
      activeLanguageRef.current = detectedLanguage;
      if (conversationId) {
        fetch(`/api/conversations/${conversationId}/language`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ language: detectedLanguage }),
        }).catch(() => {});
      }
    },
    [conversationId]
  );

  // ---- Speech out: TTS -> MuseTalk lip-sync -> avatar <video> ------------
  // Falls back to plain TTS audio over the idle loop whenever lip-sync is
  // unavailable (see hooks/useAvatarSpeech.ts).
  const {
    speak,
    stop: stopSpeaking,
    isSpeaking,
    isGenerating,
    activeClipUrl,
    onClipEnded,
    onClipError,
    notice: speechNotice,
    error: speechError,
  } = useAvatarSpeech({
    avatarId: screenProps?.avatar?.id ?? null,
    lipSyncEnabled: Boolean(screenProps?.avatar?.lipSync && screenProps.avatar.videoUrl),
  });
  const spokenCountRef = useRef(0);

  useEffect(() => {
    const assistantMessages = messages.filter((m) => m.role === "assistant");
    if (assistantMessages.length > spokenCountRef.current) {
      const latest = assistantMessages[assistantMessages.length - 1];
      spokenCountRef.current = assistantMessages.length;
      speak(latest.content, { ...(screenProps?.voice ?? {}), language: activeLanguageRef.current });
    }
  }, [messages, screenProps, speak]);

  // ---- Speech-to-text: mic -> final transcript -> send ------------------
  const micWantedRef = useRef(false);

  const {
    start: startListening,
    stop: stopListening,
    isListening,
    interimTranscript,
    isSupported: sttSupported,
    error: sttError,
  } = useSpeechToText({
    onFinalTranscript: (text, detectedLanguage, needsRepeat) => {
      if (needsRepeat) {
        // Real speech probably happened, but Whisper wasn't confident
        // enough in either the text or its language tag to trust (see
        // lib/llm/sttClient.ts's isLowConfidence()) - asking the user to
        // repeat is safer than sending possibly-garbled text to the
        // model, or worse, silently locking the conversation onto a
        // wrong detected language off one bad segment. Spoken aloud too
        // (not just shown as text) since this is a voice-first flow —
        // the user may not be looking at the screen.
        const prompt = repeatPromptFor(activeLanguageRef.current);
        setRepeatPrompt(prompt);
        // Voice only: not worth a MuseTalk round trip for "please repeat".
        speak(prompt, { ...(screenProps?.voice ?? {}), language: activeLanguageRef.current }, { lipSync: false });
        return;
      }
      setRepeatPrompt(null);
      applyDetectedLanguage(detectedLanguage);
      send(text, detectedLanguage ?? activeLanguageRef.current);
    },
  });

  // ---- Typed text: same language-follow behavior as voice --------------
  // detectTypedLanguage() is a fast, local (no network round-trip) guess —
  // good enough to tell Arabic script apart from Latin script, and French
  // apart from English via a small stopword/diacritic heuristic. It only
  // needs to be roughly right: a wrong guess here just means one reply
  // comes back in the previous language, exactly like a borderline STT
  // detection would, and it self-corrects on the next message.
  function handleSendText(text: string) {
    setRepeatPrompt(null);
    const detectedLanguage = detectTypedLanguage(text);
    applyDetectedLanguage(detectedLanguage);
    send(text, detectedLanguage ?? activeLanguageRef.current);
  }

  useEffect(() => {
    if (!micWantedRef.current) return;
    if (isSpeaking && isListening) {
      stopListening();
    } else if (!isSpeaking && !isListening) {
      startListening();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSpeaking]);

  function handleMicToggle() {
    if (isListening || micWantedRef.current) {
      micWantedRef.current = false;
      stopListening();
    } else {
      micWantedRef.current = true;
      stopSpeaking();
      startListening();
    }
  }

  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant")?.content;
  const transcript =
    streamingText ||
    interimTranscript ||
    repeatPrompt ||
    lastAssistantMessage ||
    (screenProps ? `I'm listening — ask ${screenProps.assistantName} anything.` : "Connecting…");

  const status = isSpeaking
    ? "speaking"
    : isStreaming
      ? "speaking"
      : isGenerating
        ? "thinking"
        : isListening
          ? "listening"
          : "idle";

  async function handleEndSession() {
    micWantedRef.current = false;
    stopListening();
    stopSpeaking();
    if (conversationId) {
      await fetch(`/api/conversations/${conversationId}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationSeconds: sessionSeconds, status: escalated ? "Escalated" : "Resolved" }),
      }).catch(() => {});
    }
    router.push("/experience");
  }

  if (!personaId) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-panel px-6 text-center text-sm text-neutral-500">
        No avatar selected — go back to{" "}
        <a href="/experience" className="ml-1 text-accent underline">
          the homepage
        </a>{" "}
        and pick one to talk to.
      </div>
    );
  }

  if (setupError) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-panel px-6 text-center text-sm text-red-500">
        {setupError}
      </div>
    );
  }

  return (
    <>
      {chatError && (
        <div className="fixed bottom-16 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-lg bg-red-600 px-4 py-2 text-sm text-white shadow-lg">
          The assistant couldn&apos;t answer: {chatError}
        </div>
      )}
      {speechError && (
        <div className="fixed bottom-28 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-neutral-800 px-4 py-2 text-sm text-white shadow-lg">
          {speechError}
        </div>
      )}
      {sttError && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-red-600 px-4 py-2 text-sm text-white shadow-lg">
          Mic error: {sttError}
        </div>
      )}
      <VoiceConversationScreen
        brandName={screenProps?.brandName ?? "PWC"}
        assistantName={screenProps?.assistantName ?? "Assistant"}
        assistantRole={screenProps?.assistantRole ?? ""}
        status={status}
        transcript={transcript}
        sessionSeconds={sessionSeconds}
        isLive={Boolean(conversationId)}
        onSendText={handleSendText}
        sending={isStreaming}
        onEndSession={handleEndSession}
        micActive={isListening}
        micSupported={sttSupported}
        onMicToggle={handleMicToggle}
        avatarSlot={
          screenProps?.avatar ? (
            <AvatarStage
              name={screenProps.avatar.name}
              idleVideoUrl={screenProps.avatar.videoUrl}
              posterUrl={screenProps.avatar.imageUrl}
              clipUrl={activeClipUrl}
              generating={isGenerating}
              note={speechNotice}
              onClipEnded={onClipEnded}
              onClipError={onClipError}
            />
          ) : undefined
        }
      />
    </>
  );
}