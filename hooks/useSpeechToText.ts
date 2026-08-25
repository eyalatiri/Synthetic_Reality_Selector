"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Records the mic with MediaRecorder and sends finished utterances to our
 * backend /api/stt route (Groq's free whisper-large-v3-turbo — see
 * lib/llm/sttClient.ts) instead of the browser's built-in Web Speech API
 * used previously. That swap is why this hook exists: Web Speech API is
 * Chrome/Edge-only, has no Firefox support, and has weak-to-nonexistent
 * support for Arabic dialects (Darija) — Whisper handles French, English,
 * and Arabic (including Tunisian Derja, transcribed in MSA script)
 * reliably from any modern browser that can record audio, which is all of
 * them.
 *
 * Trade-off vs. the old hook: Web Speech API streamed word-by-word
 * `interimTranscript` for free; a server round-trip to Whisper can't do
 * that; interim results here are silence-triggered chunks, not live
 * partials. `onFinalTranscript` also passes back Whisper's detected
 * language for that segment (see /api/stt) — every segment is freely
 * auto-detected (no fixed hint sent), which is what lets the caller
 * (ConversationChat.tsx) notice the user switched languages mid-session.
 *
 * IMPORTANT — sending is NOT gated on client-side "did we detect speech"
 * anymore. It used to require the RMS volume to cross a fixed threshold
 * before a segment would even be sent to Whisper, which silently dropped
 * everything on any mic/OS/gain setup where normal speaking volume
 * doesn't happen to cross that exact number (very common — RMS threshold
 * math doesn't reflect input level consistently across hardware, and
 * nothing about it throws an error, so it looks identical to "no bug").
 * Now: any non-trivial recorded blob gets sent, and Whisper's own output
 * (empty/near-empty text for true silence) is the real filter.
 *
 * Silence detection (RMS) is still used, but only to decide *when to cut
 * a chunk while you're talking continuously* — not whether to send it.
 * A `maxSegmentMs` safety timer also force-cuts a segment even if silence
 * is never detected at all, so a miscalibrated threshold can't cause the
 * recorder to just run forever in one giant untranscribed block.
 */
export function useSpeechToText({
  onFinalTranscript,
  silenceMs = 900,
  minSpeechMs = 300,
  maxSegmentMs = 12000,
  minBlobBytes = 800,
}: {
  /**
   * `language` is Whisper's detection for this segment ("English" |
   * "French" | "Arabic"), undefined if detection failed or was too
   * unreliable to trust (see `needsRepeat`).
   * `needsRepeat` is true when Whisper transcribed *something* but
   * confidence was too low to trust either the text or its language tag
   * (e.g. a real question badly misheard as a different language
   * entirely) - the caller should ask the user to say it again rather
   * than sending `text` to the model as-is. See lib/llm/sttClient.ts's
   * isLowConfidence().
   */
  onFinalTranscript: (text: string, language?: string, needsRepeat?: boolean) => void;
  /** How long the user must be quiet (once speech was heard) before we cut and transcribe the segment. */
  silenceMs?: number;
  /** Below this, a segment is treated as too short to bother auto-cutting on (still sent if it exists). */
  minSpeechMs?: number;
  /** Hard cap on one recording segment's length, in case silence is never detected (e.g. threshold never crosses on this mic). Forces a cut+send anyway. */
  maxSegmentMs?: number;
  /** Recorded blobs smaller than this (near-silence/empty) are dropped without a network call — not a speech-volume gate, just a "is there literally any audio" floor. */
  minBlobBytes?: number;
}) {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const speechStartRef = useRef<number | null>(null);
  const lastLoudRef = useRef<number>(0);
  const segmentStartRef = useRef<number>(0);
  const wantRunningRef = useRef(false);
  const onFinalRef = useRef(onFinalTranscript);
  onFinalRef.current = onFinalTranscript;

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== "undefined";
    setIsSupported(supported);
  }, []);

  const cleanupStream = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    recorderRef.current?.state !== "inactive" && recorderRef.current?.stop();
    recorderRef.current = null;
    analyserRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const sendSegment = useCallback(async () => {
    const blobs = chunksRef.current;
    chunksRef.current = [];
    speechStartRef.current = null;

    const blob = new Blob(blobs, { type: blobs[0]?.type || "audio/webm" });

    if (blob.size < minBlobBytes) {
      console.log(`[stt-debug] segment dropped: size=${blob.size}b < minBlobBytes=${minBlobBytes}b`);
      return;
    }

    console.log(`[stt-debug] sending segment: size=${blob.size} bytes, type=${blob.type}`);
    setInterimTranscript("Transcribing…");

    try {
      const form = new FormData();
      form.append("audio", blob, "segment.webm");
      // No language hint sent on purpose — see the hook docstring above.

      const res = await fetch("/api/stt", { method: "POST", body: form });
      if (!res.ok) throw new Error(`Transcription failed (${res.status})`);
      const { text, language: detectedLanguage, needsRepeat } = (await res.json()) as {
        text: string;
        language?: string;
        needsRepeat?: boolean;
      };
      console.log(`[stt-debug] transcript="${text}" language="${detectedLanguage}" needsRepeat=${needsRepeat}`);
      const trimmed = text?.trim();
      if (trimmed) onFinalRef.current(trimmed, detectedLanguage, needsRepeat);
    } catch (err) {
      console.log("[stt-debug] /api/stt request failed:", err);
      setError(err instanceof Error ? err.message : "Transcription failed");
    } finally {
      setInterimTranscript("");
    }
  }, [minBlobBytes]);

  // Starts a fresh MediaRecorder segment (called at start() and again
  // after each cut, so listening continues seamlessly).
  const startSegment = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || !wantRunningRef.current) return;

    chunksRef.current = [];
    speechStartRef.current = null;
    segmentStartRef.current = Date.now();

    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      void sendSegment();
      if (wantRunningRef.current) startSegment(); // keep listening for the next utterance
    };
    recorder.onerror = (e) => {
      console.log("[stt-debug] MediaRecorder error:", e);
    };
    recorderRef.current = recorder;
    recorder.start();
  }, [sendSegment]);

  const lastRmsLogRef = useRef(0);
  const monitorVolume = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser || !wantRunningRef.current) return;

    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);
    let sumSquares = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sumSquares += v * v;
    }
    const rms = Math.sqrt(sumSquares / data.length);
    const SPEECH_THRESHOLD = 0.01; // lowered from 0.02 — was too high for many mics/gain setups

    const now = Date.now();

    if (now - lastRmsLogRef.current > 500) {
      lastRmsLogRef.current = now;
      console.log(`[stt-debug] rms=${rms.toFixed(4)} threshold=${SPEECH_THRESHOLD}`);
    }

    if (rms > SPEECH_THRESHOLD) {
      if (speechStartRef.current === null) speechStartRef.current = now;
      lastLoudRef.current = now;
      setInterimTranscript((prev) => (prev === "Transcribing…" ? prev : "Listening…"));
    } else if (speechStartRef.current !== null && now - lastLoudRef.current >= silenceMs) {
      // Enough silence after detected speech - cut the segment and start a new one.
      console.log("[stt-debug] cutting segment: silence after speech");
      recorderRef.current?.stop();
      setInterimTranscript("");
    }

    // Safety net: even if RMS never crosses the threshold on this
    // hardware (so the branch above never fires), don't let one segment
    // run forever — cut and send it anyway after maxSegmentMs. This is
    // what guarantees /api/stt gets called even on a mic where the
    // threshold math never lines up.
    if (now - segmentStartRef.current >= maxSegmentMs) {
      console.log("[stt-debug] cutting segment: maxSegmentMs reached");
      recorderRef.current?.stop();
      setInterimTranscript("");
    }

    rafRef.current = requestAnimationFrame(monitorVolume);
  }, [silenceMs, maxSegmentMs]);

  const start = useCallback(async () => {
    if (wantRunningRef.current) return; // already running - no-op instead of throwing
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      wantRunningRef.current = true;

      const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();

      // Chrome (and other browsers) can hand back a new AudioContext in
      // "suspended" state - most commonly because the `await` above on
      // getUserMedia() breaks the direct user-gesture chain the autoplay
      // policy looks for. Explicitly resuming here is what makes the
      // analyser actually see live audio instead of reading back silence.
      console.log(`[stt-debug] AudioContext state on creation: ${audioCtx.state}`);
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
        console.log(`[stt-debug] AudioContext state after resume(): ${audioCtx.state}`);
      }

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;

      speechStartRef.current = null;
      lastLoudRef.current = Date.now();

      startSegment();
      rafRef.current = requestAnimationFrame(monitorVolume);
      setIsListening(true);
      console.log("[stt-debug] listening started");
    } catch (err) {
      wantRunningRef.current = false;
      console.log("[stt-debug] start() failed:", err);
      setError(err instanceof Error ? err.message : "Microphone access failed");
      setIsListening(false);
    }
  }, [monitorVolume, startSegment]);

  const stop = useCallback(() => {
    wantRunningRef.current = false;
    cleanupStream();
    setIsListening(false);
    setInterimTranscript("");
  }, [cleanupStream]);

  useEffect(() => () => stop(), [stop]);

  return { start, stop, isListening, interimTranscript, isSupported, error };
}