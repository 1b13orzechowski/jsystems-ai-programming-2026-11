import "server-only";

import { convertToModelMessages, isStepCount, safeValidateUIMessages, streamText } from "ai";

import { applyGuardrails } from "@/lib/domain/guardrails";
import { buildChatInstructions } from "@/lib/ai/prompts/chat";
import { loadPolicy } from "@/lib/ai/policies";
import { type ModelSet, OPENROUTER_PROVIDER_OPTIONS } from "@/lib/ai/models";
import { createIssueUpdatedDecisionTool } from "@/lib/ai/tools/issue-updated-decision";
import {
  CHAT_MESSAGE_MAX,
  CHAT_MESSAGES_MAX,
  type CaseTokenPayload,
  type ChatUIMessage,
  DecisionSchema,
  type Decision,
  UpdatedDecisionInputSchema,
} from "@/lib/domain/schemas";

// ADR-002 §3.5, ADR-003 §4: 45 s total, 15 s to the first chunk.
export const CHAT_TIMEOUT = { totalMs: 45_000, firstChunkMs: 15_000 };

export type ChatValidationError =
  | "too_many_messages"
  | "too_few_messages"
  | "last_not_user"
  | "invalid_text"
  | "file_part"
  | "invalid_message";

const MIN_MESSAGES = 2;
const TOOL_PART = "tool-issueUpdatedDecision";

function fail(reason: ChatValidationError): { ok: false; reason: ChatValidationError } {
  return { ok: false, reason };
}

/**
 * Validates client messages (ADR-002 §3.5, ADR-003 §4, AC-22, AC-27) and keeps only what the model may see:
 * user text parts, and assistant text and issueUpdatedDecision tool parts. System messages and data parts are dropped.
 */
export async function prepareChatMessages(
  uiMessages: unknown,
): Promise<{ ok: true; messages: ChatUIMessage[] } | { ok: false; reason: ChatValidationError }> {
  if (!Array.isArray(uiMessages)) return fail("invalid_message");
  if (uiMessages.length > CHAT_MESSAGES_MAX) return fail("too_many_messages");
  if (uiMessages.length < MIN_MESSAGES) return fail("too_few_messages");

  const validated = await safeValidateUIMessages<ChatUIMessage>({
    messages: uiMessages,
    dataSchemas: { decision: DecisionSchema },
    tools: {
      issueUpdatedDecision: { inputSchema: UpdatedDecisionInputSchema, outputSchema: DecisionSchema },
    },
  });
  if (!validated.success) return fail("invalid_message");

  const messages = validated.data;
  const last = messages[messages.length - 1];
  if (last === undefined || last.role !== "user") return fail("last_not_user");

  const kept: ChatUIMessage[] = [];
  for (const message of messages) {
    if (message.role === "system") continue;

    const parts = [];
    for (const part of message.parts) {
      if (part.type === "file") return fail("file_part");
      if (message.role === "user" && part.type === "text") {
        const length = Array.from(part.text).length;
        if (part.text.trim() === "" || length > CHAT_MESSAGE_MAX) return fail("invalid_text");
        parts.push(part);
      } else if (message.role === "assistant" && (part.type === "text" || part.type === TOOL_PART)) {
        parts.push(part);
      }
    }
    if (parts.length > 0) kept.push({ ...message, parts });
  }

  return { ok: true, messages: kept };
}

/**
 * Never trusts a client-supplied tool output (AC-36, ADR-000 D-04). Every historical issueUpdatedDecision part with an
 * output gets its output recomputed on the server from the part's input through the guardrails; a part whose input
 * does not parse is dropped, and so is a message left without parts.
 */
export function recomputeToolOutputs(
  payload: CaseTokenPayload,
  messages: ChatUIMessage[],
  ruleIds: ReadonlySet<string>,
): ChatUIMessage[] {
  const result: ChatUIMessage[] = [];
  for (const message of messages) {
    const parts: ChatUIMessage["parts"] = [];
    for (const part of message.parts) {
      if (part.type === TOOL_PART && part.state === "output-available") {
        const parsed = UpdatedDecisionInputSchema.safeParse(part.input);
        if (!parsed.success) continue;
        const output = applyGuardrails({
          draft: parsed.data,
          analysis: payload.analysis,
          window: payload.window,
          ruleIds,
          caseType: payload.input.caseType,
          kind: "updated",
        });
        parts.push({ ...part, output });
      } else {
        parts.push(part);
      }
    }
    if (parts.length > 0) result.push({ ...message, parts });
  }
  return result;
}

/**
 * The decision the customer sees now: the latest issued decision in history, recomputed server-side from the tool
 * input (never the client's output), else the token decision.
 */
export function currentDecision(
  payload: CaseTokenPayload,
  messages: ChatUIMessage[],
  ruleIds: ReadonlySet<string>,
): Decision {
  for (const message of [...recomputeToolOutputs(payload, messages, ruleIds)].reverse()) {
    for (const part of [...message.parts].reverse()) {
      if (part.type === TOOL_PART && part.state === "output-available") {
        const parsed = DecisionSchema.safeParse(part.output);
        if (parsed.success) return parsed.data;
      }
    }
  }
  return payload.decision;
}

export async function createChatStream(args: {
  payload: CaseTokenPayload;
  messages: ChatUIMessage[];
  models: ModelSet;
  signal?: AbortSignal;
}) {
  const { payload, messages, models, signal } = args;
  const policy = loadPolicy(payload.input.caseType);
  const trusted = recomputeToolOutputs(payload, messages, policy.ruleIds);

  return streamText({
    model: models.chat,
    instructions: buildChatInstructions({
      payload,
      currentDecision: currentDecision(payload, trusted, policy.ruleIds),
      policy,
    }),
    messages: await convertToModelMessages(trusted),
    tools: {
      issueUpdatedDecision: createIssueUpdatedDecisionTool({ payload, ruleIds: policy.ruleIds }),
    },
    stopWhen: isStepCount(2),
    timeout: CHAT_TIMEOUT,
    maxRetries: 1,
    abortSignal: signal,
    providerOptions: OPENROUTER_PROVIDER_OPTIONS.chat,
  });
}
