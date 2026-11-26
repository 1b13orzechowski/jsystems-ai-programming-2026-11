import { createUIMessageStream, createUIMessageStreamResponse } from "ai";

import { analyzeImage } from "@/lib/ai/analyze-image";
import { decide } from "@/lib/ai/decide";
import { ProcessingError } from "@/lib/ai/errors";
import { getModels } from "@/lib/ai/models";
import { loadPolicy } from "@/lib/ai/policies";
import { composeFirstMessage } from "@/lib/domain/compose-decision-message";
import { applyGuardrails } from "@/lib/domain/guardrails";
import { computePolicyWindow, todayInTimeZone } from "@/lib/domain/policy-window";
import type { CaseStreamMessage, Stage } from "@/lib/domain/schemas";
import { type AppEnv, EnvError, getEnv } from "@/lib/env";
import { logEvent } from "@/lib/server/log";
import { failureResponse, parseCaseRequest } from "@/lib/server/request-guards";
import { createCaseTokenPayload, signCaseToken } from "@/lib/security/case-token";

// ADR-003 §3-§5, A-01, A-04, A-05: one multipart request runs analysis -> decision -> guardrails ->
// first message -> signed token, streaming transient stage parts and a single data-case part.

export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new ProcessingError("timeout");
}

async function timedStage<T>(stage: Stage, run: () => Promise<T>): Promise<T> {
  const began = Date.now();
  try {
    return await run();
  } finally {
    logEvent("case_stage", { stage, durationMs: Date.now() - began });
  }
}

export async function POST(request: Request): Promise<Response> {
  const started = Date.now();

  let env: AppEnv;
  try {
    env = getEnv();
  } catch (error) {
    if (error instanceof EnvError) {
      return Response.json({ error: "CONFIG_ERROR" }, { status: 500, headers: NO_STORE });
    }
    throw error;
  }

  const now = new Date();
  const today = todayInTimeZone(now, env.appTimezone);
  const parsed = await parseCaseRequest(request, today);
  if (!parsed.ok) return failureResponse(parsed.failure);

  const { input, photo } = parsed.value;
  logEvent("case_received", { caseType: input.caseType, category: input.category });

  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(env.caseBudgetMs)]);

  const stream = createUIMessageStream<CaseStreamMessage>({
    execute: async ({ writer }) => {
      writer.write({ type: "data-stage", id: "stage", data: { stage: "analyzing" }, transient: true });

      const models = getModels();
      const analysis = await timedStage("analyzing", () =>
        analyzeImage({ caseInput: input, jpegBytes: photo, models, signal }),
      );
      throwIfAborted(signal);

      writer.write({ type: "data-stage", id: "stage", data: { stage: "deciding" }, transient: true });

      const policy = loadPolicy(input.caseType);
      const policyWindow = computePolicyWindow({
        caseType: input.caseType,
        purchaseDate: input.purchaseDate,
        now,
        timeZone: env.appTimezone,
      });
      const draft = await timedStage("deciding", () =>
        decide({ caseInput: input, analysis, window: policyWindow, policy, models, signal }),
      );
      throwIfAborted(signal);

      const decision = applyGuardrails({
        draft,
        analysis,
        window: policyWindow,
        ruleIds: policy.ruleIds,
        caseType: input.caseType,
        kind: "initial",
      });

      const caseId = crypto.randomUUID();
      const firstMessage = composeFirstMessage({ caseInput: input, decision, id: caseId });
      const caseToken = signCaseToken(
        createCaseTokenPayload({ caseId, input, analysis, decision, window: policyWindow }, now),
        env.caseSigningSecret,
      );

      writer.write({
        type: "data-case",
        id: "case",
        data: { caseId, firstMessage, decision, analysisSummaryPl: analysis.summaryPl, caseToken },
      });

      logEvent("case_completed", {
        caseId,
        label: decision.label,
        guardrailApplied: decision.guardrailApplied,
        durationMs: Date.now() - started,
      });
    },
    onError: (error) => {
      // A-04: only the machine code leaves the server. Messages, provider names and stacks are not returned or logged.
      const timedOut = (error instanceof ProcessingError && error.step === "timeout") || signal.aborted;
      const code = timedOut ? "TIMEOUT" : "PROCESSING_FAILED";
      logEvent("case_failed", {
        code,
        errorName: error instanceof Error ? error.name : "UnknownError",
        durationMs: Date.now() - started,
      });
      return code;
    },
  });

  return createUIMessageStreamResponse({ stream, headers: NO_STORE });
}
