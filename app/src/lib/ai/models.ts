import "server-only";

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";

import { type AppEnv, getEnv } from "@/lib/env";

export type ModelSet = { vision: LanguageModel; decision: LanguageModel; chat: LanguageModel };

const APP_NAME = "Hardware Service Decision Copilot";
const APP_URL = "http://localhost:3000";

type Effort = "low" | "medium";

type StepProviderOptions = {
  openrouter: {
    reasoning: { effort: Effort };
    provider: { require_parameters: true };
  };
};

// ADR-002 §3.1, §3.2, §3.5. No temperature: it is not supported by the default model.
export const OPENROUTER_PROVIDER_OPTIONS: {
  analysis: StepProviderOptions;
  decision: StepProviderOptions;
  chat: StepProviderOptions;
} = {
  analysis: { openrouter: { reasoning: { effort: "low" }, provider: { require_parameters: true } } },
  decision: { openrouter: { reasoning: { effort: "medium" }, provider: { require_parameters: true } } },
  chat: { openrouter: { reasoning: { effort: "low" }, provider: { require_parameters: true } } },
};

export function createModels(
  env: Pick<AppEnv, "openRouterApiKey" | "models">,
  options?: { fetch?: typeof fetch },
): ModelSet {
  const openrouter = createOpenRouter({
    apiKey: env.openRouterApiKey,
    appName: APP_NAME,
    appUrl: APP_URL,
    fetch: options?.fetch,
  });

  return {
    vision: openrouter(env.models.vision),
    decision: openrouter(env.models.decision),
    chat: openrouter(env.models.chat),
  };
}

let injected: ModelSet | undefined;
let memoized: ModelSet | undefined;

// Test seam: integration tests inject a model map (for example a mock model) instead of OpenRouter.
export function setModelsForTesting(models: ModelSet | undefined): void {
  injected = models;
}

export function getModels(): ModelSet {
  if (injected !== undefined) return injected;
  if (memoized === undefined) {
    memoized = createModels(getEnv());
  }
  return memoized;
}
