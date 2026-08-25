import { NextRequest } from "next/server";
import { asRecord, badRequest } from "@/lib/admin/api-utils";
import { resolveChatContext } from "@/lib/llm/resolveContext";
import { runChatPipeline, type ChatPipelinePersona } from "@/lib/llm/chatPipeline";
import type { ChatMessage } from "@/lib/llm/realtimeClient";

export const runtime = "nodejs";

// POST /api/chat — the real-time LLM turn from the architecture diagram:
// takes one user message, resolves the active persona + its knowledge
// source(s), runs RAG retrieval, and streams back the Claude completion as
// SSE frames (see chatPipeline.ts for the frame shapes).
//
// Two ways to call it:
//
//  1) Persisted flow — the employee-facing /conversation screen.
//     Body: { personaId, avatarId?, combinationId?, conversationId?, message, history?, language? }
//     Persona + knowledge source(s) are resolved from Supabase via
//     avatar_combinations, and the turn is logged if conversationId is set.
//
//  2) Preview flow — the admin avatar wizard's "Test" step, before Publish.
//     Body: { personaOverride, avatarName?, knowledgeSourceIds?, message, history?, language? }
//     `personaOverride` is whatever's currently in the wizard's in-memory
//     draft (WizardData["persona"]) — nothing is persisted or logged, and
//     no personaId exists yet to look one up by.
//
// `language` ("English" | "French" | "Arabic") is forwarded straight into
// runChatPipeline() -> buildSystemPrompt()'s language lock (see
// lib/llm/systemPrompt.ts). Omitting it lets the model just mirror
// whatever language the (transcribed) message happens to be in.
export async function POST(req: NextRequest) {
  try {
    const body = asRecord(await req.json());

    const message = body.message;
    if (typeof message !== "string" || !message.trim()) {
      return badRequest("`message` is required");
    }

    const history: ChatMessage[] = Array.isArray(body.history)
      ? (body.history as ChatMessage[]).filter(
          (m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
        )
      : [];

    let avatarName: string;
    let persona: ChatPipelinePersona;
    let knowledgeSourceIds: string[];
    let conversationId: string | null = null;

    if (body.personaOverride && typeof body.personaOverride === "object" && !Array.isArray(body.personaOverride)) {
      persona = body.personaOverride as ChatPipelinePersona;
      avatarName = typeof body.avatarName === "string" ? body.avatarName : persona.name || "Avatar";
      knowledgeSourceIds = Array.isArray(body.knowledgeSourceIds) ? (body.knowledgeSourceIds as string[]) : [];
    } else {
      const personaId = typeof body.personaId === "string" ? body.personaId : undefined;
      const avatarId = typeof body.avatarId === "string" ? body.avatarId : undefined;
      const combinationId = typeof body.combinationId === "string" ? body.combinationId : undefined;

      if (!personaId && !combinationId) {
        return badRequest("`personaId` (or `combinationId`) is required when not using `personaOverride`");
      }

      const resolved = await resolveChatContext({ personaId, avatarId, combinationId });
      avatarName = resolved.avatarName;
      persona = resolved.persona;
      knowledgeSourceIds = resolved.knowledgeSourceIds;
      conversationId = typeof body.conversationId === "string" ? body.conversationId : null;
    }

    const language = typeof body.language === "string" ? body.language : undefined;

    const stream = runChatPipeline({
      avatarName,
      persona,
      knowledgeSourceIds,
      message: message.trim(),
      history,
      conversationId,
      language,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Unexpected server error";
    // Same SSE shape as a mid-stream error, so the client's frame parser
    // (see hooks/useChatStream.ts) can handle both with one code path.
    return new Response(`data: ${JSON.stringify({ type: "error", message })}\n\n`, {
      status: 500,
      headers: { "Content-Type": "text/event-stream; charset=utf-8" },
    });
  }
}