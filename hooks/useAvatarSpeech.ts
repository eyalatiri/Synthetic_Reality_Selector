"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AvatarVoice = {
  voice?: string;
  gender?: "female" | "male";
  language?: string;
};

type Clip = { kind: "video" | "audio"; url: string };

// One MuseTalk call per reply is the right default while the notebook runs
// scripts.inference as a fresh subprocess (every call re-loads weights and
// re-processes the source video — fixed cost per call). Only turn chunking
// on (NEXT_PUBLIC_AVATAR_CHUNKING=1) after moving the notebook to a
// persistent worker; then sentence-level clips let playback start sooner.
const CHUNKING = process.env.NEXT_PUBLIC_AVATAR_CHUNKING === "1";
const TTS_TIMEOUT_MS = 20 * 1000;
const LIPSYNC_TIMEOUT_MS = 6 * 60 * 1000;
const LIPSYNC_COOLDOWN_MS = 60 * 1000; // after a failure, go voice-only this long

function splitIntoChunks(text: string, minChars = 60): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (!CHUNKING) return [trimmed];
  const sentences = trimmed.match(/[^.!?؟…\n]+[.!?؟…]+["')\]]*\s*|[^.!?؟…\n]+$/g) ?? [trimmed];
  const chunks: string[] = [];
  let buf = "";
  for (const s of sentences) {
    buf += s;
    if (buf.trim().length >= minChars) {
      chunks.push(buf.trim());
      buf = "";
    }
  }
  if (buf.trim()) {
    if (chunks.length) chunks[chunks.length - 1] += " " + buf.trim();
    else chunks.push(buf.trim());
  }
  return chunks;
}

/** An AbortSignal that fires when `parent` does OR after `ms`. */
function linkedTimeout(parent: AbortSignal, ms: number) {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  if (parent.aborted) ctrl.abort();
  else parent.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => ctrl.abort(), ms);
  return {
    signal: ctrl.signal,
    clear: () => {
      clearTimeout(timer);
      parent.removeEventListener("abort", onAbort);
    },
  };
}

/**
 * Speaks assistant replies through the avatar.
 *
 * Per reply:  text -> /api/tts (Edge TTS mp3) -> /api/avatar/lip-sync
 *             (MuseTalk mp4 with the audio muxed in) -> <video> in AvatarStage.
 *
 * If lip-sync is unavailable (Kaggle off, error, no avatar video) it falls
 * back to playing the TTS audio over the idle loop, so the conversation
 * never breaks — and stops retrying for a minute so every turn doesn't pay
 * a failed round trip.
 *
 * The component that renders the clip (AvatarStage) reports back through
 * onClipEnded / onClipError; audio-only fallback clips are played here.
 */
export function useAvatarSpeech({
  avatarId,
  lipSyncEnabled,
}: {
  avatarId: string | null;
  lipSyncEnabled: boolean;
}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeClipUrl, setActiveClipUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runIdRef = useRef(0); // bumped by every speak()/stop(); stale async work checks it
  const abortRef = useRef<AbortController | null>(null);
  const queueRef = useRef<Clip[]>([]);
  const currentRef = useRef<Clip | null>(null);
  const producedAllRef = useRef(true);
  const urlsRef = useRef<string[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lipSyncDownUntilRef = useRef(0);
  const cfgRef = useRef({ avatarId, lipSyncEnabled });
  cfgRef.current = { avatarId, lipSyncEnabled };

  const revokeAll = useCallback(() => {
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];
  }, []);

  const finish = useCallback(() => {
    currentRef.current = null;
    setActiveClipUrl(null);
    setIsSpeaking(false);
    revokeAll();
  }, [revokeAll]);

  const pump = useCallback(
    (runId: number) => {
      if (runId !== runIdRef.current || currentRef.current) return;
      const next = queueRef.current.shift();
      if (!next) {
        // Nothing queued: either we're done, or the next chunk is still being
        // generated (stay "speaking" so the mic doesn't re-open in the gap).
        if (producedAllRef.current) finish();
        return;
      }
      currentRef.current = next;
      setIsSpeaking(true);

      if (next.kind === "video") {
        setActiveClipUrl(next.url); // AvatarStage plays it and calls onClipEnded
        return;
      }
      const audio = new Audio(next.url);
      audioRef.current = audio;
      const advance = () => {
        if (runId !== runIdRef.current) return;
        currentRef.current = null;
        pump(runId);
      };
      audio.onended = advance;
      audio.onerror = () => {
        setError("Playback failed");
        advance();
      };
      audio.play().catch(() => {
        setError("The browser blocked audio playback — click the page and try again.");
        advance();
      });
    },
    [finish]
  );

  const stop = useCallback(() => {
    runIdRef.current++;
    abortRef.current?.abort();
    abortRef.current = null;
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current = null;
    }
    queueRef.current = [];
    producedAllRef.current = true;
    setIsGenerating(false);
    finish();
  }, [finish]);

  const speak = useCallback(
    async (text: string, voice: AvatarVoice, opts?: { lipSync?: boolean }) => {
      const parts = splitIntoChunks(text);
      if (!parts.length) return;

      stop(); // a new reply always interrupts the previous one
      setError(null);
      const runId = runIdRef.current;
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      producedAllRef.current = false;
      setIsGenerating(true);

      const wantLipSync = () =>
        opts?.lipSync !== false &&
        cfgRef.current.lipSyncEnabled &&
        Boolean(cfgRef.current.avatarId) &&
        Date.now() >= lipSyncDownUntilRef.current;

      const track = (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        urlsRef.current.push(url);
        return url;
      };
      const stale = () => runId !== runIdRef.current;

      try {
        for (const part of parts) {
          // 1) text -> speech
          console.log(`[speak] TTS request (${part.length} chars, lipSync=${wantLipSync()})`);
          const tt = linkedTimeout(ctrl.signal, TTS_TIMEOUT_MS);
          let audioBlob: Blob;
          try {
            const ttsRes = await fetch("/api/tts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: part, ...voice }),
              signal: tt.signal,
            });
            if (!ttsRes.ok) {
              const b = await ttsRes.json().catch(() => ({}));
              throw new Error(`TTS failed (${ttsRes.status}): ${b.error ?? "unknown"}`);
            }
            audioBlob = await ttsRes.blob();
          } catch (e) {
            if (!ctrl.signal.aborted) {
              // aborted by the timeout, not by the user
              throw tt.signal.aborted ? new Error("TTS timed out after 20s (Edge TTS unreachable?)") : e;
            }
            throw e;
          } finally {
            tt.clear();
          }
          console.log(`[speak] TTS ok: ${audioBlob.size} bytes`);
          if (stale()) return;

          // 2) speech -> lip-synced video (best effort)
          let clip: Clip = { kind: "audio", url: "" };
          let gotVideo = false;
          if (wantLipSync()) {
            const t = linkedTimeout(ctrl.signal, LIPSYNC_TIMEOUT_MS);
            try {
              console.log("[speak] sending audio to /api/avatar/lip-sync");
              const form = new FormData();
              form.append("audio", audioBlob, "reply.mp3");
              form.append("avatarId", cfgRef.current.avatarId as string);
              const res = await fetch("/api/avatar/lip-sync", { method: "POST", body: form, signal: t.signal });
              if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error ?? `Lip-sync failed (${res.status})`);
              }
              const videoBlob = await res.blob();
              if (stale()) return;
              console.log(`[speak] lip-sync ok: ${videoBlob.size} bytes`);
              clip = { kind: "video", url: track(videoBlob) };
              gotVideo = true;
              setNotice(null);
            } catch (err) {
              if (stale() || ctrl.signal.aborted) return; // user interrupted — not a failure
              console.warn("Lip-sync unavailable, falling back to voice only:", err);
              lipSyncDownUntilRef.current = Date.now() + LIPSYNC_COOLDOWN_MS;
              const reason = err instanceof Error ? err.message : "unknown error";
              setNotice(`MuseTalk unavailable — voice only. ${reason}`.slice(0, 220));
            } finally {
              t.clear();
            }
          }
          if (!gotVideo) clip = { kind: "audio", url: track(audioBlob) };

          // 3) hand to the player
          queueRef.current.push(clip);
          pump(runId);
        }
      } catch (err) {
        if (!stale() && !ctrl.signal.aborted) {
          setError(err instanceof Error ? err.message : "Failed to speak reply");
        }
      } finally {
        if (!stale()) {
          producedAllRef.current = true;
          setIsGenerating(false);
          pump(runId); // finishes the run if nothing is left to play
        }
      }
    },
    [pump, stop]
  );

  // Called by <AvatarStage> when the lip-synced <video> finishes (or fails).
  const onClipEnded = useCallback(() => {
    currentRef.current = null;
    setActiveClipUrl(null);
    pump(runIdRef.current);
  }, [pump]);

  const onClipError = useCallback(
    (message?: string) => {
      if (message) setError(message);
      onClipEnded();
    },
    [onClipEnded]
  );

  useEffect(() => stop, [stop]); // unmount cleanup

  return { speak, stop, isSpeaking, isGenerating, activeClipUrl, onClipEnded, onClipError, notice, error };
}
