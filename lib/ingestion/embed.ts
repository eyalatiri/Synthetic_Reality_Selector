// lib/ingestion/embed.ts
//
// Embedding provider switch. Both providers serve BAAI/bge-m3 (1024 dims):
//   - "cloudflare"  -> Cloudflare Workers AI, free tier (10k neurons/day), no card
//   - "huggingface" -> HF Inference Providers (needs pre-paid credits)
//
// Select with EMBEDDING_PROVIDER in .env.local. If unset: Cloudflare when
// CF_ACCOUNT_ID + CF_API_TOKEN are present, otherwise Hugging Face.

type Provider = "cloudflare" | "huggingface";
type InputType = "document" | "query";

function resolveProvider(): Provider {
  const explicit = (process.env.EMBEDDING_PROVIDER || "").trim().toLowerCase();
  if (explicit === "cloudflare" || explicit === "huggingface") return explicit;
  return process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN
    ? "cloudflare"
    : "huggingface";
}

const HF_EMBEDDING_MODEL = process.env.HF_EMBEDDING_MODEL ?? "BAAI/bge-m3";
const HF_ENDPOINT = `https://router.huggingface.co/hf-inference/models/${HF_EMBEDDING_MODEL}/pipeline/feature-extraction`;

const CF_MODEL = process.env.CF_EMBEDDING_MODEL ?? "@cf/baai/bge-m3";

export const EMBEDDING_DIMENSIONS = Number(
  process.env.EMBEDDING_DIMENSIONS ?? process.env.HF_EMBEDDING_DIMENSIONS ?? 1024
);

// Cloudflare accepts arrays but very large ones can be rejected, so keep
// batches modest. HF prefers small batches too.
const BATCH_SIZE = 20;
const MAX_RETRIES = 4;
const RETRY_DELAY_MS = 2000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Thrown for responses retrying can't fix (no credits/quota, bad key, bad request).
class NonRetryableEmbeddingError extends Error {}

export async function embedTexts(
  texts: string[],
  inputType: InputType
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const provider = resolveProvider();
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const embeddings = await embedBatchWithRetry(batch, provider, inputType);
    results.push(...embeddings);
  }

  return results;
}

async function embedBatchWithRetry(
  batch: string[],
  provider: Provider,
  inputType: InputType
): Promise<number[][]> {
  // A live chat turn (query) must fail fast so the avatar can still answer
  // without knowledge; bulk ingestion can afford to wait and retry.
  const maxRetries = inputType === "query" ? 1 : MAX_RETRIES;
  const timeoutMs = inputType === "query" ? 6_000 : 60_000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const vectors =
        provider === "cloudflare"
          ? await callCloudflare(batch, timeoutMs)
          : await callHuggingFace(batch, timeoutMs);

      if (vectors.length !== batch.length) {
        throw new Error(
          `Embedding count mismatch: sent ${batch.length}, got ${vectors.length}`
        );
      }
      return vectors;
    } catch (err) {
      if (err instanceof NonRetryableEmbeddingError) throw err;
      if (attempt < maxRetries) {
        console.warn(
          `Embedding request failed [${provider}] (attempt ${attempt + 1}/${
            maxRetries + 1
          }): ${(err as Error).message}`
        );
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
      throw err;
    }
  }

  throw new Error("Embedding request failed after all retries.");
}

// Marker error so the retry loop can back off on 429/503 without treating
// them as fatal.
class RetryableStatusError extends Error {}

// ---- Cloudflare Workers AI ------------------------------------------------
async function callCloudflare(batch: string[], timeoutMs: number): Promise<number[][]> {
  const accountId = process.env.CF_ACCOUNT_ID;
  const token = process.env.CF_API_TOKEN;
  if (!accountId || !token) {
    throw new NonRetryableEmbeddingError(
      "Missing CF_ACCOUNT_ID / CF_API_TOKEN in .env.local"
    );
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${CF_MODEL}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ text: batch }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");

    // Free-tier daily allowance used up - retrying today won't help.
    if (/daily free allocation|neurons/i.test(body) || body.includes("4006")) {
      throw new NonRetryableEmbeddingError(
        "Cloudflare Workers AI daily free quota exhausted (resets 00:00 UTC). " + body
      );
    }
    if (res.status === 401 || res.status === 403) {
      throw new NonRetryableEmbeddingError(
        `Cloudflare rejected the request (${res.status}) - check CF_API_TOKEN permissions (Workers AI) and CF_ACCOUNT_ID. ` +
          body
      );
    }
    if (res.status === 400 || res.status === 404) {
      throw new NonRetryableEmbeddingError(
        `Cloudflare embeddings bad request (${res.status}) model=${CF_MODEL}. ` + body
      );
    }
    // 429 / 5xx -> let the retry loop handle it
    throw new RetryableStatusError(
      `Cloudflare embeddings failed (${res.status}) Response=${body}`
    );
  }

  const json = (await res.json()) as {
    success?: boolean;
    result?: { data?: number[][]; shape?: number[] };
    errors?: unknown[];
  };

  const data = json.result?.data;
  if (!json.success || !Array.isArray(data)) {
    throw new Error(
      `Cloudflare returned an unexpected response: ${JSON.stringify(json).slice(0, 300)}`
    );
  }

  return data;
}

// ---- Hugging Face Inference Providers -------------------------------------
async function callHuggingFace(batch: string[], timeoutMs: number): Promise<number[][]> {
  const apiKey = process.env.HF_API_KEY;
  if (!apiKey) {
    throw new NonRetryableEmbeddingError("Missing HF_API_KEY in .env.local");
  }

  const res = await fetch(HF_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      inputs: batch,
      // HF cold-starts the model on first call; wait server-side.
      options: { wait_for_model: true },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 402 || res.status === 403) {
      throw new NonRetryableEmbeddingError(
        res.status === 402
          ? "Hugging Face credits exhausted (402) - top up credits or switch EMBEDDING_PROVIDER. " + body
          : `Hugging Face rejected the request (${res.status}) - check HF_API_KEY. ` + body
      );
    }
    throw new RetryableStatusError(
      `HF embeddings failed (${res.status}) URL=${HF_ENDPOINT} Response=${body}`
    );
  }

  const json = (await res.json()) as number[][] | number[][][];
  return json.map((vec) => poolIfNeeded(vec));
}

// bge-m3 normally returns one pooled 1024-dim vector per input. If HF ever
// routes to a raw token-embeddings response (one vector per token),
// mean-pool it so the output shape is always consistent.
function poolIfNeeded(vec: number[] | number[][]): number[] {
  if (Array.isArray(vec[0])) {
    const tokenVecs = vec as number[][];
    const dim = tokenVecs[0].length;
    const pooled = new Array(dim).fill(0);
    for (const tv of tokenVecs) {
      for (let d = 0; d < dim; d++) pooled[d] += tv[d];
    }
    return pooled.map((sum) => sum / tokenVecs.length);
  }
  return vec as number[];
}