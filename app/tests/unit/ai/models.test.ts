import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    openRouterApiKey: "sk-or-synthetic-test-key",
    models: { vision: "vendor/vision-env", decision: "vendor/decision-env", chat: "vendor/chat-env" },
  }),
}));

import { OPENROUTER_PROVIDER_OPTIONS, createModels, getModels, setModelsForTesting } from "@/lib/ai/models";

// Synthetic values only. The fetch stub fails loudly if any request is attempted (TAC-001-03).
const SYNTHETIC_ENV = {
  openRouterApiKey: "sk-or-synthetic-test-key",
  models: { vision: "openai/gpt-6-luna", decision: "vendor/decision-override", chat: "vendor/chat-override" },
};

const noNetworkFetch: typeof fetch = async () => {
  throw new Error("Network access is disabled in unit tests");
};

describe("createModels", () => {
  afterEach(() => {
    setModelsForTesting(undefined);
  });

  it("returns vision, decision and chat models with the configured model IDs", () => {
    const models = createModels(SYNTHETIC_ENV, { fetch: noNetworkFetch });

    expect(models.vision).toMatchObject({ modelId: "openai/gpt-6-luna" });
    expect(models.decision).toMatchObject({ modelId: "vendor/decision-override" });
    expect(models.chat).toMatchObject({ modelId: "vendor/chat-override" });
  });

  it("does not make network calls while creating models", () => {
    expect(() => createModels(SYNTHETIC_ENV, { fetch: noNetworkFetch })).not.toThrow();
  });
});

describe("getModels", () => {
  afterEach(() => {
    setModelsForTesting(undefined);
  });

  it("returns the injected model set after setModelsForTesting", () => {
    const injected = createModels(SYNTHETIC_ENV, { fetch: noNetworkFetch });

    setModelsForTesting(injected);

    expect(getModels()).toBe(injected);
  });

  it("builds models from the environment when nothing is injected and memoizes them", () => {
    setModelsForTesting(undefined);

    const first = getModels();

    expect(first.chat).toMatchObject({ modelId: "vendor/chat-env" });
    expect(getModels()).toBe(first);
  });
});

describe("OPENROUTER_PROVIDER_OPTIONS", () => {
  it("uses low effort for analysis and require_parameters routing", () => {
    expect(OPENROUTER_PROVIDER_OPTIONS.analysis).toEqual({
      openrouter: { reasoning: { effort: "low" }, provider: { require_parameters: true } },
    });
  });

  it("uses medium effort for the decision step with require_parameters routing", () => {
    expect(OPENROUTER_PROVIDER_OPTIONS.decision).toEqual({
      openrouter: { reasoning: { effort: "medium" }, provider: { require_parameters: true } },
    });
  });

  it("uses low effort for chat with require_parameters routing", () => {
    expect(OPENROUTER_PROVIDER_OPTIONS.chat).toEqual({
      openrouter: { reasoning: { effort: "low" }, provider: { require_parameters: true } },
    });
  });

  it("never sets temperature", () => {
    expect(JSON.stringify(OPENROUTER_PROVIDER_OPTIONS)).not.toContain("temperature");
  });
});
