"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The avatar picture. Two stacked layers:
 *   1. the idle loop — the admin's uploaded video, muted, looping forever;
 *   2. the reply clip — MuseTalk's lip-synced MP4 (audio included), faded
 *      in on top while it plays, then faded out to reveal the idle loop.
 * Both come from the same source video, so they share aspect ratio and
 * crop (object-cover) and the hand-over is just a cross-fade.
 */
export function AvatarStage({
  name,
  idleVideoUrl,
  posterUrl,
  clipUrl,
  generating,
  note,
  onClipEnded,
  onClipError,
}: {
  name: string;
  idleVideoUrl: string | null;
  posterUrl: string | null;
  clipUrl: string | null;
  /** True while a reply's video is being generated (idle loop keeps playing). */
  generating: boolean;
  /** Short status line (e.g. why lip-sync fell back to voice only). */
  note?: string | null;
  onClipEnded: () => void;
  onClipError: (message?: string) => void;
}) {
  // Only real URLs are usable as a still: blob: URLs saved by older wizard
  // runs are dead after the tab that made them closes (they rendered as a
  // broken-image icon on a black panel).
  const poster = posterUrl && /^https?:\/\//.test(posterUrl) ? posterUrl : null;
  const [idleFailed, setIdleFailed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const showVideo = Boolean(idleVideoUrl) && !idleFailed;
  const elapsed = useElapsedSeconds(generating);

  return (
    <div className="absolute inset-0 overflow-hidden bg-neutral-900">
      {showVideo ? (
        <video
          key={idleVideoUrl}
          src={idleVideoUrl ?? undefined}
          poster={poster ?? undefined}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          onError={() => {
            console.error("Avatar idle video failed to load:", idleVideoUrl);
            setIdleFailed(true);
          }}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : poster && !posterFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster}
          alt=""
          onError={() => setPosterFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}

      {!showVideo ? (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-8 text-center text-sm leading-relaxed text-neutral-300">
          {idleFailed
            ? `${name}'s video couldn't be loaded. Check that the Supabase "avatars" bucket is public and the file is an H.264 MP4.`
            : `${name} has no avatar video yet — upload one in Admin → Avatars.`}
        </div>
      ) : null}

      {clipUrl ? <ReplyClip key={clipUrl} url={clipUrl} onEnded={onClipEnded} onError={onClipError} /> : null}

      {generating && !clipUrl ? (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-4 py-2 text-xs font-medium text-white backdrop-blur-sm">
          Generating {name}&apos;s lip-synced reply… {elapsed}s
        </div>
      ) : null}

      {note ? (
        <div className="absolute left-4 top-4 max-w-[70%] rounded-lg bg-amber-500/90 px-3 py-2 text-xs font-medium text-black">
          {note}
        </div>
      ) : null}
    </div>
  );
}

function useElapsedSeconds(active: boolean) {
  const [s, setS] = useState(0);
  useEffect(() => {
    if (!active) return;
    setS(0);
    const t0 = Date.now();
    const id = setInterval(() => setS(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, [active]);
  return s;
}

function ReplyClip({
  url,
  onEnded,
  onError,
}: {
  url: string;
  onEnded: () => void;
  onError: (message?: string) => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Autoplay-with-sound can be refused if the page never had a user
    // gesture (e.g. a hard reload straight onto /conversation).
    ref.current?.play().catch(() => onError("The browser blocked video playback — click the page and try again."));
  }, [onError]);

  return (
    <video
      ref={ref}
      src={url}
      playsInline
      onPlaying={() => setVisible(true)}
      onEnded={onEnded}
      onError={() => onError("The avatar video could not be played.")}
      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}
