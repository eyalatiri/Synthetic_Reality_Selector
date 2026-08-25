"use client";

import { useState } from "react";
import {
  Mic,
  MicOff,
  Wrench,
  Camera,
  Move,
  X,
  Settings,
  Maximize2,
  Send,
} from "lucide-react";

// ---- Types -----------------------------------------------------------
export type ConversationStatus = "listening" | "speaking" | "idle";

export interface VoiceConversationScreenProps {
  brandName?: string;
  assistantName?: string;
  assistantRole?: string;
  status?: ConversationStatus;
  /** Plain transcript text. Wrap the phrase you want highlighted in **double asterisks**. */
  transcript?: string;
  sessionSeconds?: number;
  isLive?: boolean;
  onMicToggle?: () => void;
  onEndSession?: () => void;
  /**
   * Temporary text-input tester until Deepgram STT is wired up. Only
   * rendered when provided, so this stays a no-op for any other caller of
   * this component. Remove this prop (and <TextTester>) once real mic
   * capture replaces it.
   */
  onSendText?: (text: string) => void;
  /** Disables the text tester input while a reply is streaming in. */
  sending?: boolean;
  /** Controls the mic button from outside (real STT listening state). Falls back to local state when omitted. */
  micActive?: boolean;
  /** False when the browser has no Web Speech API — shows a hint instead of hiding the button. */
  micSupported?: boolean;
}

// ---- Helpers -----------------------------------------------------------
function formatSession(seconds: number) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

/** Renders transcript text, turning **phrase** into an orange highlighted span. */
function HighlightedTranscript({ text }: { text: string }) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <span key={i} className="text-accent">
            {part.slice(2, -2)}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

// ---- Main component -----------------------------------------------------------
export default function VoiceConversationScreen({
  brandName = "PWC",
  assistantName = "SRS TN",
  assistantRole = "Senior HR Advisor",
  status = "listening",
  transcript = "I'm listening — take your time. You just asked about **WFH** for new hires.",
  sessionSeconds = 252,
  isLive = true,
  onMicToggle,
  onEndSession,
  onSendText,
  sending = false,
  micActive,
  micSupported = true,
}: VoiceConversationScreenProps) {
  // Local fallback state so this component still works standalone (e.g.
  // admin preview) when no micActive prop is passed in. Once a parent
  // drives real STT (see ConversationChat.tsx), micActive takes over.
  const [localMicOn, setLocalMicOn] = useState(false);
  const micOn = micActive ?? localMicOn;

  function handleMicClick() {
    if (micActive === undefined) setLocalMicOn((v) => !v);
    onMicToggle?.();
  }

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-panel">
      {/* Vertical edge label */}
      <span className="pointer-events-none absolute bottom-6 left-3 z-20 origin-bottom-left -rotate-90 text-[10px] font-medium tracking-[0.25em] text-neutral-400">
        {assistantName.toUpperCase()} · DIGITAL HUMAN · {brandName}
      </span>

      {/* ---------------- Left panel ---------------- */}
      <div className="relative flex w-full flex-col justify-between px-16 py-10 md:w-[46%]">
        {/* Header */}
        <div>
          <div>
            <h1 className="text-lg font-bold tracking-wide text-neutral-900">
              {brandName}
            </h1>
            <div className="mt-1 h-[2px] w-8 bg-accent" />
          </div>
          <p className="mt-3 text-sm text-neutral-500">
            {assistantName} · {assistantRole}
          </p>
        </div>

        {/* Transcript block */}
        <div className="max-w-md">
          <div className="mb-6 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            <span className="text-xs font-semibold tracking-[0.2em] text-neutral-600">
              {status.toUpperCase()}
            </span>
          </div>

          <p className="font-serif text-4xl italic leading-tight text-neutral-900">
            <HighlightedTranscript text={transcript} />
          </p>

          <div className="mt-8 flex items-center gap-3 text-sm">
            <span className="font-semibold text-neutral-900">
              {assistantName}
            </span>
            <span className="h-4 w-px bg-neutral-300" />
            <span className="text-neutral-500">Always here to help</span>
          </div>

          {/* Waveform squiggle */}
          <svg
            viewBox="0 0 220 24"
            className="mt-6 h-6 w-52"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M0 12 L20 4 L40 20 L60 4 L80 20 L100 4 L120 20 L140 4 L160 20 L180 4 L200 20 L220 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-accent"
            />
          </svg>

          {/* Temporary text-input tester — stands in for the mic/Deepgram
              STT pipeline until that's wired up, so the real persona +
              knowledge + LLM turn can still be tested end to end here. */}
          {onSendText ? <TextTester onSend={onSendText} disabled={sending} /> : null}
        </div>

        {/* Controls */}
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleMicClick}
              disabled={!micSupported}
              aria-label={micOn ? "Stop listening" : "Start listening"}
              aria-pressed={micOn}
              className={`flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 ${
                micOn ? "bg-accent shadow-orange-900/20 animate-pulse" : "bg-neutral-800 shadow-black/20"
              }`}
            >
              {micOn ? <Mic size={22} /> : <MicOff size={22} />}
            </button>

            <div className="mx-1 h-8 w-px bg-neutral-300" />

            <IconButton label="Tools">
              <Wrench size={18} />
            </IconButton>
            <IconButton label="Camera">
              <Camera size={18} />
            </IconButton>
            <IconButton label="Move avatar">
              <Move size={18} />
            </IconButton>
            <IconButton label="End session" onClick={onEndSession}>
              <X size={18} />
            </IconButton>
          </div>

          <p className="mt-4 text-xs text-neutral-500">
            {formatSession(sessionSeconds)} session
          </p>
          {!micSupported && (
            <p className="mt-1 text-xs text-red-500">
              Voice input isn&apos;t supported in this browser — try Chrome or Edge, or use the text input below.
            </p>
          )}
        </div>
      </div>

      {/* ---------------- Right panel (avatar video) ---------------- */}
      <div className="relative hidden flex-1 md:block">
        {/* Placeholder for the live HeyGen avatar stream.
            Replace this div's contents with the HeyGen embed/video element. */}
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 via-neutral-700 to-neutral-900">
          <div className="flex h-full items-center justify-center text-sm tracking-wide text-neutral-400">
            Avatar video stream mounts here
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

        {/* Top-right utility bar */}
        <div className="absolute right-6 top-6 flex items-center gap-2 rounded-full bg-black/30 px-3 py-2 backdrop-blur-sm">
          <span className="px-1 text-xs font-medium text-white">EN</span>
          <IconButton label="Settings" dark>
            <Settings size={16} />
          </IconButton>
          <IconButton label="Fullscreen" dark>
            <Maximize2 size={16} />
          </IconButton>
        </div>

        {/* Live badge */}
        {isLive && (
          <div className="absolute bottom-6 right-6 flex items-center gap-2 rounded-full bg-black/50 px-4 py-2 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            <span className="text-xs font-medium text-white">
              {assistantName} · live
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Text-input tester (temporary, until Deepgram STT lands) -----------------------------------------------------------
function TextTester({ onSend, disabled }: { onSend: (text: string) => void; disabled?: boolean }) {
  const [value, setValue] = useState("");

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
  }

  return (
    <div className="mt-6 flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-2 py-1.5 shadow-sm">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Type to test (until voice is wired)…"
        disabled={disabled}
        className="flex-1 bg-transparent px-3 py-1.5 text-sm text-neutral-800 outline-none placeholder:text-neutral-400 disabled:opacity-50"
      />
      <button
        type="button"
        onClick={submit}
        disabled={disabled}
        aria-label="Send test message"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-transform hover:scale-105 disabled:opacity-50"
      >
        <Send size={14} />
      </button>
    </div>
  );
}

// ---- Small shared icon button -----------------------------------------------------------
function IconButton({
  children,
  label,
  dark = false,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  dark?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={
        dark
          ? "flex h-8 w-8 items-center justify-center rounded-full text-white/90 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          : "flex h-10 w-10 items-center justify-center rounded-full border border-neutral-300 text-neutral-500 transition hover:border-neutral-400 hover:text-neutral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      }
    >
      {children}
    </button>
  );
}
