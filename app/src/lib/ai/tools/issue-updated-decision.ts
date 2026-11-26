import "server-only";

import { tool } from "ai";

import { applyGuardrails } from "@/lib/domain/guardrails";
import { type CaseTokenPayload, type Decision, UpdatedDecisionInputSchema } from "@/lib/domain/schemas";

// ADR-002 §3.5: the only way the chat agent changes the decision. Every result passes guardrails G1–G6.
export function createIssueUpdatedDecisionTool(ctx: { payload: CaseTokenPayload; ruleIds: ReadonlySet<string> }) {
  const { payload, ruleIds } = ctx;
  return tool({
    description: "Issue an updated preliminary decision when new information changes the outcome under the policy.",
    inputSchema: UpdatedDecisionInputSchema,
    execute: (input): Decision =>
      applyGuardrails({
        draft: input,
        analysis: payload.analysis,
        window: payload.window,
        ruleIds,
        caseType: payload.input.caseType,
        kind: "updated",
      }),
  });
}
