// lib/ingestion/embed.ts

const HF_EMBEDDING_MODEL =
  process.env.HF_EMBEDDING_MODEL ?? "BAAI/bge-m3";

const HF_EMBEDDING_DIMENSIONS = Number(
  process.env.HF_EMBEDDING_DIMENSIONS ?? 1024
);

export const EMBEDDING_DIMENSIONS = HF_EMBEDDING_DIMENSIONS;

const HF_ENDPOINT = `https://router.huggingface.co/hf-inference/models/${HF_EMBEDDING_MODEL}/pipeline/feature-extraction`;

const BATCH_SIZE = 32; // HF hosted inference API prefers smaller batches than Azure did
const MAX_RETRIES = 4;
const RETRY_DELAY_MS = 2000;

type InputType = "document" | "query";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function embedTexts(
  texts: string[],
  _inputType: InputType
): Promise<number[][]> {
  const apiKey = process.env.HF_API_KEY;

  if (!apiKey) {
    throw new Error("Missing HF_API_KEY in .env.local");
  }

  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const embeddings = await embedBatchWithRetry(batch, apiKey);
    results.push(...embeddings);
  }

  return results;
}

async function embedBatchWithRetry(
  batch: string[],
  apiKey: string
): Promise<number[][]> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log("Embedding URL:", HF_ENDPOINT);
      console.log("Embedding Model:", HF_EMBEDDING_MODEL);

      const res = await fetch(HF_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          inputs: batch,
          // wait_for_model: HF cold-starts the model on first call instead
          // of erroring immediately; this makes that wait happen server-side.
          options: { wait_for_model: true },
        }),
      });

      // 503 = model still loading/cold-starting on HF's side, not a hard failure
      if ((res.status === 429 || res.status === 503) && attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }

      if (!res.ok) {
        const body = await res.text();
        throw new Error(
          `Embeddings request failed (${res.status}) URL=${HF_ENDPOINT} Response=${body}`
        );
      }

      const json = (await res.json()) as number[][] | number[][][];

      return json.map((vec) => normalizeVector(vec));
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        console.warn(
          `Embedding request failed (attempt ${attempt + 1}/${
            MAX_RETRIES + 1
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

// bge-m3 is published in sentence-transformers format, so the HF feature-
// extraction pipeline normally returns one pooled 1024-dim vector per input
// (number[][]). If HF ever routes to a raw token-embeddings response
// (number[][][] — one vector per token) instead, mean-pool it here so the
// output shape is always consistent.
function normalizeVector(vec: number[] | number[][]): number[] {
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