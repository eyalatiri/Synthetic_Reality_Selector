// Run from the project root:  node scripts/test-edge-tts.mjs
// Tries every known way of reaching Microsoft's free Edge TTS and prints which one your network accepts.
// Writes edge-test.mp3 for the first variant that works.
import { createHash, randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import WebSocket from "ws";

const TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const VERSION = "1-143.0.3650.75";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0";

function gec() {
  let t = Date.now() / 1000 + 11644473600;
  t -= t % 300;
  t *= 1e7;
  return createHash("sha256").update(`${t.toFixed(0)}${TOKEN}`, "ascii").digest("hex").toUpperCase();
}

const NEW = "wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1";
const OLD = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";
const variants = [
  { name: "A  new host, key in query + header (what the app uses)", url: NEW, q: { "Ocp-Apim-Subscription-Key": TOKEN }, h: { "Ocp-Apim-Subscription-Key": TOKEN } },
  { name: "B  new host, key in query only", url: NEW, q: { "Ocp-Apim-Subscription-Key": TOKEN }, h: {} },
  { name: "C  new host, key in header only", url: NEW, q: {}, h: { "Ocp-Apim-Subscription-Key": TOKEN } },
  { name: "D  new host, TrustedClientToken", url: NEW, q: { TrustedClientToken: TOKEN }, h: {} },
  { name: "E  old host (known 403 for many)", url: OLD, q: { TrustedClientToken: TOKEN }, h: {} },
];

function run(v) {
  return new Promise((resolve) => {
    const id = randomBytes(16).toString("hex");
    const params = new URLSearchParams({ ConnectionId: id, ...v.q, "Sec-MS-GEC": gec(), "Sec-MS-GEC-Version": VERSION });
    const ws = new WebSocket(`${v.url}?${params}`, {
      headers: { "User-Agent": UA, Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold", Cookie: `muid=${randomBytes(16).toString("hex").toUpperCase()};`, ...v.h },
      handshakeTimeout: 10000,
    });
    const audio = [];
    let done = false;
    const finish = (msg) => { if (done) return; done = true; clearTimeout(timer); try { ws.terminate(); } catch {} resolve({ msg, audio: Buffer.concat(audio) }); };
    const timer = setTimeout(() => finish("TIMEOUT (10s)"), 10000);
    ws.on("unexpected-response", (_r, res) => finish(`REJECTED: HTTP ${res.statusCode} ${res.statusMessage || ""}`));
    ws.on("error", (e) => finish(`ERROR: ${e.message}`));
    ws.on("close", () => finish(audio.length ? "ok" : "closed without audio"));
    ws.on("open", () => {
      const ts = new Date().toUTCString();
      ws.send(`X-Timestamp:${ts}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`);
      ws.send(`X-RequestId:${id}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${ts}Z\r\nPath:ssml\r\n\r\n<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='fr-FR'><voice name='fr-FR-VivienneMultilingualNeural'><prosody pitch='+0Hz' rate='+0%' volume='+0%'>Bonjour, ceci est un test.</prosody></voice></speak>`);
    });
    ws.on("message", (d, bin) => {
      if (!bin) { if (d.toString().includes("Path:turn.end")) finish("ok"); return; }
      const hl = d.readUInt16BE(0);
      if (d.subarray(2, 2 + hl).toString().includes("Path:audio")) { const b = d.subarray(2 + hl); if (b.length) audio.push(Buffer.from(b)); }
    });
  });
}

let saved = false;
console.log(`Local time: ${new Date().toISOString()}\n`);
for (const v of variants) {
  const r = await run(v);
  const ok = r.msg === "ok" && r.audio.length > 0;
  console.log(`${ok ? "WORKS " : "FAILS "} ${v.name}\n        -> ${ok ? r.audio.length + " bytes of audio" : r.msg}`);
  if (ok && !saved) { writeFileSync("edge-test.mp3", r.audio); saved = true; console.log("        (saved edge-test.mp3)"); }
}
console.log(saved ? "\nAt least one variant works. Play edge-test.mp3 to hear it." : "\nNothing worked from this network - use Azure (free key) or TTS_PROVIDER=google.");
