// lib/llm/chatClient.ts
// Replaces lib/llm/realtimeClient.ts (deleted - see git history for the
// full gpt-realtime-2 debugging saga: wrong WS path, temperature rejected
// at both session.update and response.create, ~10-1000x pricier per token
// than the Claude models we now use). This is a plain HTTP + SSE client
// against this gateway's standard /chat/completions route - same
// debuggability as lib/ingestion/embed.ts (curl-testable, clear status
// codes/JSON error bodies) instead of opaque WebSocket handshake failures.
import "server-only";
import { DEFAULT_MAX_TOKENS } from "./models";

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ChatUsage = { promptTokens: number; completionTokens: number };

type StreamArgs = {
  model: string;
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
  /** 0-1, same range chatPipeline.ts already computes from persona.creativity */
  temperature?: number;
  usageOut?: { current: ChatUsage | null };
  signal?: AbortSignal;
};

// Groq's OpenAI-compatible Chat Completions endpoint. No per-resource base
// URL like Azure had - it's a single fixed host, auth is a plain Bearer
// token (GROQ_API_KEY), and the model string picks the model directly
// (see lib/llm/models.ts) rather than routing through a gateway/proxy.
function getEndpoint(): string {
  return "https://api.groq.com/openai/v1/chat/completions";
}

// chatPipeline.ts's persona.creativity is already normalized to 0-1 before
// reaching this function. We pass that value through unchanged (no *2
// scaling onto OpenAI's 0-2 range) because Anthropic Claude's native
// `temperature` range is 0-1, and a value >1 would be rejected. 0-1 is
// safe for every model this gateway proxies (OpenAI, Claude via Bedrock,
// Gemini via Vertex).
function toChatTemperature(t: number | undefined): number {
  return Number(Math.min(1, Math.max(0, t ?? 0.5)).toFixed(2));
}

/**
 * Streams a text reply via standard OpenAI-compatible Chat Completions
 * (SSE). Works against any model this gateway proxies since they all
 * share the same normalized request/response schema through LiteLLM.
 */
export async function* streamChatMessage({
  model,
  system,
  messages,
  maxTokens = DEFAULT_MAX_TOKENS,
  temperature,
  usageOut,
  signal,
}: StreamArgs): AsyncGenerator<string, void, unknown> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing GROQ_API_KEY in .env.local");

  const url = getEndpoint();

  const body = {
    model,
    messages: [{ role: "system", content: system }, ...messages],
    max_tokens: maxTokens,
    temperature: toChatTemperature(temperature),
    stream: true,
    stream_options: { include_usage: true },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`Chat completions request failed (${res.status}) URL=${url} Model=${model} Response=${text}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") return;

        let json: any;
        try {
          json = JSON.parse(payload);
        } catch {
          continue; // partial/malformed chunk - skip rather than crash the stream
        }

        const delta = json.choices?.[0]?.delta?.content;
        if (delta) yield delta;

        if (json.usage && usageOut) {
          usageOut.current = {
            promptTokens: json.usage.prompt_tokens ?? 0,
            completionTokens: json.usage.completion_tokens ?? 0,
          };
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}