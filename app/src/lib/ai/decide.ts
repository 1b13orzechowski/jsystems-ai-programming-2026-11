import "server-only";

import { generateText, Output } from "ai";

import {
  type CaseInput,
  type DecisionDraft,
  DecisionDraftSchema,
  type ImageAnalysis,
  type PolicyWindow,
} from "@/lib/domain/schemas";

import type { Policy } from "./policies";
import { processingFailure } from "./errors";
import { type ModelSet, OPENROUTER_PROVIDER_OPTIONS } from "./models";
import { buildDecisionInstructions, buildDecisionPrompt } from "./prompts/decision";

// ADR-002 §3.2: one text call, at most 25 s in total.
export const DECISION_TIMEOUT_MS = 25_000;

export async function decide(args: {
  caseInput: CaseInput;
  analysis: ImageAnalysis;
  window: PolicyWindow;
  policy: Policy;
  models: ModelSet;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<DecisionDraft> {
  const { caseInput, analysis, window, policy, models, signal, timeoutMs = DECISION_TIMEOUT_MS } = args;

  try {
    const result = await generateText({
      model: models.decision,
      instructions: buildDecisionInstructions(caseInput.caseType),
      prompt: buildDecisionPrompt({ input: caseInput, analysis, window, policy }),
      output: Output.object({ schema: DecisionDraftSchema }),
      maxOutputTokens: 2000,
      maxRetries: 1,
      timeout: { totalMs: timeoutMs },
      abortSignal: signal,
      providerOptions: OPENROUTER_PROVIDER_OPTIONS.decision,
    });
    return result.output;
  } catch (cause) {
    throw processingFailure("decision", cause, signal);
  }
}
