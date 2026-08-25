import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_CONTENT_LENGTH_BYTES = 15 * 1024 * 1024; // 15MB safety cap

export type FetchedPage = { title: string; textContent: string };

/**
 * Fetches a URL server-side and extracts its main readable content —
 * stripping nav/ads/boilerplate the same way Firefox's reader mode does —
 * so what lands in the vector DB is the article, not the whole page's markup.
 */
export async function fetchAndExtractUrl(rawUrl: string): Promise<FetchedPage> {
  const url = validateUrl(rawUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // Some sites block requests with no/unknown User-Agent.
        "User-Agent": "Mozilla/5.0 (compatible; PwC-AvatarBot-KnowledgeIngest/1.0)",
      },
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error(`Timed out fetching "${rawUrl}" after ${FETCH_TIMEOUT_MS / 1000}s`);
    }
    throw new Error(`Could not reach "${rawUrl}": ${(err as Error).message}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    throw new Error(`Fetching "${rawUrl}" failed with status ${res.status}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
    throw new Error(
      `"${rawUrl}" doesn't look like an HTML page (content-type: ${contentType || "unknown"}) — only web pages are supported, not direct file links.`
    );
  }

  const contentLength = res.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_CONTENT_LENGTH_BYTES) {
    throw new Error(`"${rawUrl}" is too large to ingest (${contentLength} bytes, max 15MB)`);
  }

  const html = await res.text();
  const dom = new JSDOM(html, { url: url.toString() });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article || !article.textContent?.trim()) {
    throw new Error(
      `Could not extract readable content from "${rawUrl}" — the page may be JS-rendered (content loaded after page load, which a plain fetch won't see) or have no identifiable main article content.`
    );
  }

  return {
    title: article.title?.trim() || url.hostname,
    textContent: article.textContent.trim(),
  };
}

/**
 * Basic SSRF guard: only http/https, and block obvious internal/private
 * targets (localhost, RFC1918 ranges, cloud metadata endpoint). This is an
 * admin-only panel today, but a URL-fetch feature is exactly the kind of
 * thing that gets exposed more broadly later — worth guarding now rather
 * than retrofitting once it's harder to change.
 */
function validateUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`"${rawUrl}" is not a valid URL`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Only http/https URLs are supported, got "${url.protocol}"`);
  }

  const hostname = url.hostname.toLowerCase();
  const isBlocked =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "169.254.169.254" || // cloud provider metadata endpoint
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);

  if (isBlocked) {
    throw new Error(`Refusing to fetch internal/private address "${hostname}"`);
  }

  return url;
}
