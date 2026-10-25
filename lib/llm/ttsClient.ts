import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { resolveSpokenLanguage, resolveTtsVoice } from "./models";

/**
 * Text-to-speech with a provider chain (see the "Provider chain" note below).
 *
 * EDGE ("edge") - Microsoft's free Edge read-aloud service, spoken to directly
 * over a websocket (no edge-tts-universal). Two reasons it is hand-written:
 *   1. Since ~2026-10-10 the old host speech.platform.bing.com answers HTTP 403
 *      in many regions (rany2/edge-tts#490). Edge now uses
 *      wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1 with the
 *      client token as `Ocp-Apim-Subscription-Key` (see readest/readest#6722).
 *   2. edge-tts-universal's Node client never handles a failed handshake, so a
 *      403 made /api/tts hang forever instead of failing. Here every failure
 *      (HTTP status, timeout, premature close) rejects with a readable message.
 * Override with EDGE_TTS_URL / EDGE_TTS_GEC_VERSION in .env.local if Microsoft
 * changes either again.
 */

const EDGE_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const EDGE_URL = process.env.EDGE_TTS_URL || "wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1";
const EDGE_GEC_VERSION = process.env.EDGE_TTS_GEC_VERSION || "1-143.0.3650.75";
const EDGE_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0";
const EDGE_TIMEOUT_MS = 10_000;

const g = globalThis as typeof globalThis & { __edgeSkewSec?: number; __edgeSkewAt?: number };

/** Sec-MS-GEC = SHA256(<5-min-rounded Windows file time><token>) - uses the server-synced clock. */
function secMsGec(): string {
  let ticks = Date.now() / 1000 + (g.__edgeSkewSec ?? 0) + 11644473600;
  ticks -= ticks % 300;
  ticks *= 1e7;
  return createHash("sha256").update(`${ticks.toFixed(0)}${EDGE_TOKEN}`, "ascii").digest("hex").toUpperCase();
}

/** Aligns our clock with Microsoft's (the token is only valid for the current 5-minute window). */
async function syncClock(): Promise<void> {
  if (g.__edgeSkewAt && Date.now() - g.__edgeSkewAt < 10 * 60 * 1000) return;
  try {
    const res = await fetch("https://api.msedgeservices.com/", { method: "HEAD", signal: AbortSignal.timeout(4000), cache: "no-store" });
    const date = res.headers.get("date");
    if (date) {
      g.__edgeSkewSec = new Date(date).getTime() / 1000 - Date.now() / 1000;
      g.__edgeSkewAt = Date.now();
      console.log(`[tts] clock offset vs Microsoft: ${g.__edgeSkewSec.toFixed(1)}s`);
    }
  } catch {
    /* best effort - local clock is usually fine */
  }
}

async function synthesizeEdge(text: string, voice: string, rate: string, pitch: string): Promise<Buffer> {
  await syncClock();

  // `ws` ships as a dependency of edge-tts-universal; loaded lazily so a missing install gives a clear error.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let WS: any;
  try {
    // @ts-ignore - no bundled types needed for this one call
    WS = (await import("ws")).default;
  } catch {
    throw new Error('The "ws" package is missing - run: npm i ws');
  }

  const connectId = randomBytes(16).toString("hex");
  const params = new URLSearchParams({
    ConnectionId: connectId,
    "Ocp-Apim-Subscription-Key": EDGE_TOKEN,
    "Sec-MS-GEC": secMsGec(),
    "Sec-MS-GEC-Version": EDGE_GEC_VERSION,
  });
  const lang = voice.split("-").slice(0, 2).join("-");
  const stamp = () => new Date().toUTCString().replace("GMT", "GMT+0000 (Coordinated Universal Time)");

  return new Promise<Buffer>((resolve, reject) => {
    const audio: Buffer[] = [];
    let settled = false;
    const done = (err: Error | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.terminate();
      } catch {
        /* already closed */
      }
      if (err) reject(err);
      else if (audio.length === 0) reject(new Error("Edge TTS closed without sending audio"));
      else resolve(Buffer.concat(audio));
    };

    const ws = new WS(`${EDGE_URL}?${params.toString()}`, {
      headers: {
        "User-Agent": EDGE_UA,
        Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
        Pragma: "no-cache",
        "Cache-Control": "no-cache",
        "Accept-Language": "en-US,en;q=0.9",
        Cookie: `muid=${randomBytes(16).toString("hex").toUpperCase()};`,
        "Ocp-Apim-Subscription-Key": EDGE_TOKEN,
      },
      handshakeTimeout: EDGE_TIMEOUT_MS,
    });
    const timer = setTimeout(() => done(new Error(`Edge TTS timed out after ${EDGE_TIMEOUT_MS / 1000}s`)), EDGE_TIMEOUT_MS);

    ws.on("unexpected-response", (_req: unknown, res: { statusCode?: number; statusMessage?: string; headers: Record<string, unknown> }) => {
      done(new Error(`Edge TTS handshake rejected: HTTP ${res.statusCode} ${res.statusMessage ?? ""}`.trim()));
    });
    ws.on("error", (e: Error) => done(new Error(`Edge TTS websocket error: ${e?.message ?? e}`)));
    ws.on("close", () => done(null));

    ws.on("open", () => {
      ws.send(
        `X-Timestamp:${stamp()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
          `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`
      );
      const ssml =
        `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${lang}'>` +
        `<voice name='${voice}'><prosody pitch='${pitch}' rate='${rate}' volume='+0%'>${xmlEscape(text)}</prosody></voice></speak>`;
      ws.send(
        `X-RequestId:${connectId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${stamp()}Z\r\nPath:ssml\r\n\r\n${ssml}`
      );
    });

    ws.on("message", (data: Buffer, isBinary: boolean) => {
      if (!isBinary) {
        // Text frames: turn.start / response / turn.end
        if (data.toString("utf8").includes("Path:turn.end")) done(null);
        return;
      }
      // Binary frame: 2-byte big-endian header length, header text, then the audio bytes.
      if (data.length < 2) return;
      const headerLen = data.readUInt16BE(0);
      if (headerLen + 2 > data.length) return;
      const header = data.subarray(2, 2 + headerLen).toString("utf8");
      if (header.includes("Path:audio")) {
        const body = data.subarray(2 + headerLen);
        if (body.length > 0) audio.push(Buffer.from(body));
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Provider chain.
//
// Since ~2026-10-10 Microsoft's free Edge read-aloud endpoint answers HTTP 403
// to many clients (see rany2/edge-tts#490), so it can't be the only option.
//
//   TTS_PROVIDER=azure   Azure Speech REST (needs AZURE_SPEECH_KEY + AZURE_SPEECH_REGION;
//                        free F0 tier = 500k chars/month; same neural voices incl. ar-TN)
//   TTS_PROVIDER=google  Google Translate TTS - no key, free, one voice per language
//   TTS_PROVIDER=edge    Microsoft Edge read-aloud, free, no key (see the note at the top)
//   (unset)              "auto": azure (if the key is set) -> edge -> google
// ---------------------------------------------------------------------------
type Provider = "azure" | "google" | "edge";

function providerOrder(): Provider[] {
  const forced = process.env.TTS_PROVIDER?.trim().toLowerCase();
  if (forced === "azure" || forced === "google" || forced === "edge") return [forced];
  const order: Provider[] = [];
  if (process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION) order.push("azure");
  order.push("edge", "google");
  return order;
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  const o = e as { message?: string; error?: { message?: string } } | null;
  return o?.message ?? o?.error?.message ?? String(e);
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

async function synthesizeAzure(text: string, voice: string, rate: string, pitch: string): Promise<Buffer> {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) throw new Error("AZURE_SPEECH_KEY / AZURE_SPEECH_REGION are not set in .env.local");
  const lang = voice.split("-").slice(0, 2).join("-"); // "fr-FR-Vivienne..." -> "fr-FR"
  const ssml =
    `<speak version="1.0" xml:lang="${lang}" xmlns="http://www.w3.org/2001/10/synthesis">` +
    `<voice name="${voice}"><prosody rate="${rate}" pitch="${pitch}">${xmlEscape(text)}</prosody></voice></speak>`;
  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "avatar-chatbot",
    },
    body: ssml,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Azure Speech ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) throw new Error("Azure Speech returned no audio");
  return buf;
}

/** Splits text into <=maxLen pieces on sentence/clause/space boundaries (Google's endpoint caps ~200 chars). */
function chunkText(text: string, maxLen = 180): string[] {
  const pieces = text.replace(/\s+/g, " ").trim().match(/[^.!?؟…\n;:،]+[.!?؟…;:،]*\s*|\S+/g) ?? [text];
  const out: string[] = [];
  let buf = "";
  const push = () => {
    if (buf.trim()) out.push(buf.trim());
    buf = "";
  };
  for (const piece of pieces) {
    if (piece.length > maxLen) {
      push();
      let rest = piece;
      while (rest.length > maxLen) {
        let cut = rest.lastIndexOf(" ", maxLen);
        if (cut < maxLen / 2) cut = maxLen;
        out.push(rest.slice(0, cut).trim());
        rest = rest.slice(cut);
      }
      buf = rest;
    } else if ((buf + piece).length > maxLen) {
      push();
      buf = piece;
    } else {
      buf += piece;
    }
  }
  push();
  return out.filter(Boolean);
}

async function synthesizeGoogle(text: string, voice: string, language?: string): Promise<Buffer> {
  // Prefer an explicit voice's language prefix ("fr-FR-..." -> fr), else the conversation language.
  const lang = voice
    ? voice.slice(0, 2).toLowerCase()
    : ({ English: "en", French: "fr", Arabic: "ar" } as const)[resolveSpokenLanguage(language)];
  const parts = chunkText(text);
  const buffers: Buffer[] = [];
  for (let i = 0; i < parts.length; i++) {
    const url =
      `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(lang)}` +
      `&total=${parts.length}&idx=${i}&textlen=${parts[i].length}&q=${encodeURIComponent(parts[i])}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36" },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Google TTS ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 200) throw new Error("Google TTS returned no audio");
    buffers.push(buf);
  }
  return Buffer.concat(buffers); // concatenated MP3 frames play/decode fine (ffmpeg in MuseTalk handles it)
}

export async function synthesizeSpeech(
  text: string,
  opts?: {
    /** Explicit voice name (e.g. "fr-FR-VivienneMultilingualNeural"). Takes priority over gender/language. */
    voice?: string;
    gender?: "female" | "male";
    /** Conversation language ("English" | "French" | "Arabic") - see models.ts#resolveSpokenLanguage. */
    language?: string;
    rate?: string; // e.g. "+0%"
    pitch?: string; // e.g. "+0Hz"
  }
): Promise<Buffer> {
  const voice = opts?.voice || resolveTtsVoice(opts?.gender, opts?.language);
  const rate = opts?.rate ?? "+0%";
  const pitch = opts?.pitch ?? "+0Hz";
  const t0 = Date.now();
  const errors: string[] = [];

  for (const provider of providerOrder()) {
    try {
      console.log(`[tts] ${provider}: start voice=${voice} chars=${text.length}`);
      const audio =
        provider === "azure"
          ? await synthesizeAzure(text, voice, rate, pitch)
          : provider === "google"
            ? await synthesizeGoogle(text, opts?.voice ? voice : "", opts?.language)
            : await synthesizeEdge(text, voice, rate, pitch);
      console.log(`[tts] ${provider}: ok ${audio.length} bytes in ${Date.now() - t0}ms`);
      return audio;
    } catch (e) {
      const m = `${provider}: ${errMsg(e)}`;
      errors.push(m);
      console.error(`[tts] ${m}`);
    }
  }
  throw new Error(`All TTS providers failed - ${errors.join(" | ")}`);
}
