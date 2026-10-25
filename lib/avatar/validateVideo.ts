// Shared by the admin upload UIs (client) and create-video/route.ts (server
// reads only AVATAR_VIDEO_LIMITS) — no browser APIs are touched at import time.

export const AVATAR_VIDEO_LIMITS = {
  maxBytes: 30 * 1024 * 1024,
  minSeconds: 3,
  // The source video is re-uploaded to MuseTalk on every reply and MuseTalk
  // preprocesses every frame each time, so length costs latency directly.
  maxSeconds: 20,
  minHeight: 256,
} as const;

function readMetadata(file: File): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const done = (fn: () => void) => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      fn();
    };
    const timer = setTimeout(() => done(() => reject(new Error("timeout"))), 10_000);
    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () =>
      done(() => resolve({ duration: video.duration, width: video.videoWidth, height: video.videoHeight }));
    video.onerror = () => done(() => reject(new Error("unreadable")));
    video.src = url;
  });
}

/** Returns a user-facing error message, or null when the file is fine. */
export async function validateAvatarVideo(file: File): Promise<string | null> {
  const L = AVATAR_VIDEO_LIMITS;
  if (!file.type.startsWith("video/")) return "Please choose a video file (MP4 or WebM).";
  if (file.size > L.maxBytes) return `That video is ${(file.size / 1e6).toFixed(0)} MB — the limit is ${L.maxBytes / 1e6} MB.`;

  let meta;
  try {
    meta = await readMetadata(file);
  } catch {
    // Also catches HEVC/.mov files the browser can't decode: the avatar's idle
    // loop is played in the browser, so an unplayable file is unusable.
    return "Your browser can't read this video. Re-export it as an H.264 MP4 and try again.";
  }

  if (meta.duration < L.minSeconds) return `The video is too short (${meta.duration.toFixed(1)}s) — use at least ${L.minSeconds}s.`;
  if (meta.duration > L.maxSeconds) {
    return `The video is ${meta.duration.toFixed(0)}s long — trim it to ${L.maxSeconds}s or less (every reply is lip-synced against it).`;
  }
  if (meta.height < L.minHeight) return `The video resolution is too low (${meta.width}×${meta.height}).`;
  return null;
}
