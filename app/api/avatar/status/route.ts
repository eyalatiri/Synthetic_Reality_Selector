import { NextResponse } from "next/server";
import { musetalkBaseUrl } from "@/lib/musetalk/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/avatar/status — one-click diagnosis of the MuseTalk link. Open
// http://<your-dev-host>:3000/api/avatar/status in a browser.
//
//   configured:false      -> KAGGLE_MUSETALK_URL missing (restart `npm run dev` after editing .env.local)
//   reachable:false       -> notebook stopped, ngrok URL changed, or this PC can't reach ngrok
//   reachable:true        -> /lip-sync should work; a slow reply is just MuseTalk's inference time
export async function GET() {
  const base = musetalkBaseUrl();
  if (!base) {
    return NextResponse.json({ configured: false, reachable: false, hint: "Set KAGGLE_MUSETALK_URL in .env.local and restart npm run dev." });
  }

  const t0 = Date.now();
  try {
    const res = await fetch(`${base}/health`, {
      headers: { "ngrok-skip-browser-warning": "1" },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    const text = await res.text();
    const isOurApp = res.ok && text.trim().startsWith("{");
    return NextResponse.json({
      configured: true,
      url: base,
      reachable: isOurApp,
      httpStatus: res.status,
      latencyMs: Date.now() - t0,
      hint: isOurApp
        ? "MuseTalk service is up."
        : "The URL answers but it is not the MuseTalk API (ngrok interstitial / stale tunnel). Re-run Step 6 in the notebook and copy the NEW URL.",
      bodyPreview: isOurApp ? undefined : text.slice(0, 200),
    });
  } catch (err) {
    return NextResponse.json({
      configured: true,
      url: base,
      reachable: false,
      latencyMs: Date.now() - t0,
      error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
      hint: "Could not connect. Is the Kaggle notebook's Step 6 cell still running? Did the ngrok URL change?",
    });
  }
}
