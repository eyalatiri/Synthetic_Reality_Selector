import "server-only";

// Server-side client for the Kaggle-hosted MuseTalk service (see the
// MuseTalk notebook: GET /health, POST /lip-sync). Only /lip-sync does real
// work — MuseTalk needs an audio track to generate anything, so it is
// called once per assistant reply, never at avatar-creation time.

const NGROK_HEADERS = { "ngrok-skip-browser-warning": "1" };

export class MusetalkError extends Error {
  constructor(
    message: string,
    /** "not_configured" | "unreachable" | "failed" — the route maps these to HTTP codes. */
    readonly kind: "not_configured" | "unreachable" | "failed"
  ) {
    super(message);
    this.name = "MusetalkError";
  }
}

export function musetalkBaseUrl(): string | null {
  const url = process.env.KAGGLE_MUSETALK_URL?.trim().replace(/\/+$/, "");
  return url || null;
}

/** Fast liveness probe — used when a conversation starts so the UI knows whether lip-sync can be attempted. */
export async function isMusetalkUp(timeoutMs = 2500): Promise<boolean> {
  const base = musetalkBaseUrl();
  if (!base) return false;
  try {
    const res = await fetch(`${base}/health`, {
      headers: NGROK_HEADERS,
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    // ngrok serves an HTML interstitial (200) when the tunnel is up but the
    // notebook is gone, so insist on our JSON body, not just a 200.
    return res.ok && (await res.text()).trim().startsWith("{");
  } catch {
    return false;
  }
}

// ---- Source-video cache ----------------------------------------------------
// Every /lip-sync call needs the avatar's source video. Re-downloading it
// from Supabase on every turn would add seconds of latency, so keep the
// bytes in memory. The cache key is the video URL, which contains a random
// UUID (see create-video/route.ts), so a re-uploaded video is a new key and
// stale entries can never be served. Stored on globalThis so Next's dev
// HMR doesn't wipe it on every edit.
type CacheEntry = { blob: Blob; at: number };
const g = globalThis as typeof globalThis & { __musetalkSourceCache?: Map<string, CacheEntry> };
const sourceCache = (g.__musetalkSourceCache ??= new Map<string, CacheEntry>());
const SOURCE_TTL_MS = 30 * 60 * 1000;
const SOURCE_MAX_ENTRIES = 16;

async function getSourceVideo(videoUrl: string): Promise<Blob> {
  const hit = sourceCache.get(videoUrl);
  if (hit && Date.now() - hit.at < SOURCE_TTL_MS) return hit.blob;

  const res = await fetch(videoUrl, { signal: AbortSignal.timeout(60_000), cache: "no-store" });
  if (!res.ok) throw new MusetalkError(`Could not download the avatar video (${res.status})`, "failed");
  const blob = await res.blob();

  if (sourceCache.size >= SOURCE_MAX_ENTRIES) {
    const oldest = [...sourceCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) sourceCache.delete(oldest[0]);
  }
  sourceCache.set(videoUrl, { blob, at: Date.now() });
  return blob;
}

/** Warm the cache while the conversation is being set up. Never throws. */
export async function primeSourceVideo(videoUrl: string): Promise<void> {
  try {
    await getSourceVideo(videoUrl);
  } catch {
    /* best effort — lipSync() will retry the download itself */
  }
}

function extensionOf(url: string): string {
  const match = /\.([a-z0-9]{2,4})(?:\?|$)/i.exec(url);
  return match ? match[1].toLowerCase() : "mp4";
}

/**
 * Sends the avatar's source video + one reply's audio to MuseTalk and
 * returns the lip-synced MP4 (audio already muxed in by MuseTalk).
 */
export async function lipSync(videoUrl: string, audio: Blob): Promise<ArrayBuffer> {
  const base = musetalkBaseUrl();
  if (!base) {
    throw new MusetalkError("KAGGLE_MUSETALK_URL is not set in .env.local", "not_configured");
  }

  const source = await getSourceVideo(videoUrl);

  const form = new FormData();
  form.append("source_video", source, `avatar.${extensionOf(videoUrl)}`);
  form.append("audio", audio, "reply.mp3");

  let res: Response;
  try {
    res = await fetch(`${base}/lip-sync`, {
      method: "POST",
      headers: NGROK_HEADERS,
      body: form,
      // Stateless MuseTalk reloads its weights on every call (see the
      // notebook's last note), so a single reply can take a few minutes.
      signal: AbortSignal.timeout(5 * 60 * 1000),
    });
  } catch (err) {
    throw new MusetalkError(
      "Could not reach the MuseTalk service — the Kaggle notebook may be stopped or its ngrok URL changed. " +
        `(${err instanceof Error ? err.message : "network error"})`,
      "unreachable"
    );
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new MusetalkError(`MuseTalk failed (${res.status}): ${detail.slice(0, 600)}`, "failed");
  }
  return res.arrayBuffer();
}
