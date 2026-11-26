import "server-only";

import { z } from "zod";

import { createChatStream, prepareChatMessages } from "@/lib/ai/chat-agent";
import { getModels } from "@/lib/ai/models";
import { getEnv } from "@/lib/env";
import { logEvent } from "@/lib/server/log";
import {
  CHAT_BODY_LIMIT_BYTES,
  checkContentLength,
  failureResponse,
  type GuardFailure,
} from "@/lib/server/request-guards";
import { verifyCaseToken } from "@/lib/security/case-token";

// ADR-003 §3-§5, A-04: POST /api/chat streams the chat agent reply as a UI message stream for useChat.
// Every rejection happens before any LLM call. Error bodies carry only machine codes.

export const maxDuration = 60;

const CASE_TOKEN_MAX_CHARS = 16_384;

const EnvelopeSchema = z.object({
  id: z.string(),
  caseToken: z.string().max(CASE_TOKEN_MAX_CHARS),
  trigger: z.enum(["submit-message", "regenerate-message"]).optional(),
  messages: z.unknown(),
});

const PAYLOAD_TOO_LARGE: GuardFailure = { status: 413, code: "PAYLOAD_TOO_LARGE" };
const encoder = new TextEncoder();

function jsonError(status: number, error: string): Response {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

function reject(status: number, code: string): Response {
  logEvent("chat_rejected", { code, status });
  return jsonError(status, code);
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}

export async function POST(request: Request): Promise<Response> {
  let env: ReturnType<typeof getEnv>;
  try {
    env = getEnv();
  } catch {
    return jsonError(500, "CONFIG_ERROR");
  }

  const declaredTooLarge = checkContentLength(request, CHAT_BODY_LIMIT_BYTES);
  if (declaredTooLarge) return failureResponse(declaredTooLarge);

  const raw = await request.text();
  if (encoder.encode(raw).byteLength > CHAT_BODY_LIMIT_BYTES) return failureResponse(PAYLOAD_TOO_LARGE);

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return reject(400, "INVALID_MESSAGES");
  }

  const envelope = EnvelopeSchema.safeParse(json);
  if (!envelope.success) {
    const tokenProblem = envelope.error.issues.some((issue) => issue.path[0] === "caseToken");
    return tokenProblem ? reject(401, "INVALID_CASE_TOKEN") : reject(400, "INVALID_MESSAGES");
  }

  const verified = verifyCaseToken(envelope.data.caseToken, env.caseSigningSecret, new Date());
  if (!verified.ok) return reject(401, "INVALID_CASE_TOKEN");

  const prepared = await prepareChatMessages(envelope.data.messages);
  if (!prepared.ok) return reject(400, "INVALID_MESSAGES");
  const { messages } = prepared;

  logEvent("chat_received", { messageCount: messages.length });

  let result: Awaited<ReturnType<typeof createChatStream>>;
  try {
    result = await createChatStream({
      payload: verified.payload,
      messages,
      models: getModels(),
      signal: request.signal,
    });
  } catch (error) {
    logEvent("chat_failed", { errorName: errorName(error) });
    return jsonError(500, "CHAT_FAILED");
  }

  let streamFailed = false;
  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onError: (error) => {
      streamFailed = true;
      logEvent("chat_failed", { errorName: errorName(error) });
      return "CHAT_FAILED";
    },
    onEnd: () => {
      if (!streamFailed) logEvent("chat_completed", {});
    },
    headers: { "Cache-Control": "no-store" },
  });
}
