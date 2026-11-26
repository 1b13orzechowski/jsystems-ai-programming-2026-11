import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { DEFAULT_CASE_BUDGET_MS, EnvError, parseEnv } from "@/lib/env";

// Synthetic values only (never real keys). 32 bytes of base64 = a valid signing secret.
const SECRET_32 = Buffer.alloc(32, 7).toString("base64");
const SECRET_16 = Buffer.alloc(16, 7).toString("base64");
const API_KEY = "synthetic-openrouter-key-123";

function minimalEnv(overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return {
    OPENROUTER_API_KEY: API_KEY,
    LLM_MODEL: "openai/gpt-6-luna",
    CASE_SIGNING_SECRET: SECRET_32,
    ...overrides,
  };
}

describe("parseEnv", () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("applies defaults for a valid minimal env", () => {
    const env = parseEnv(minimalEnv());

    expect(env.openRouterApiKey).toBe(API_KEY);
    expect(env.models).toEqual({
      vision: "openai/gpt-6-luna",
      decision: "openai/gpt-6-luna",
      chat: "openai/gpt-6-luna",
    });
    expect(env.caseSigningSecret).toBe(SECRET_32);
    expect(env.appTimezone).toBe("Europe/Warsaw");
    expect(env.caseBudgetMs).toBe(55000);
    expect(DEFAULT_CASE_BUDGET_MS).toBe(55000);
    expect(warn).not.toHaveBeenCalled();
  });

  it("applies per-step model overrides", () => {
    const env = parseEnv(
      minimalEnv({
        VISION_MODEL: "vision/model-a",
        DECISION_MODEL: "decision/model-b",
        CHAT_MODEL: "chat/model-c",
      }),
    );

    expect(env.models).toEqual({
      vision: "vision/model-a",
      decision: "decision/model-b",
      chat: "chat/model-c",
    });
  });

  it("throws EnvError naming a missing OPENROUTER_API_KEY without printing secret values", () => {
    const source = minimalEnv({ OPENROUTER_API_KEY: undefined });

    let caught: unknown;
    try {
      parseEnv(source);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(EnvError);
    if (!(caught instanceof EnvError)) throw new Error("unreachable");
    expect(caught.message).toContain("OPENROUTER_API_KEY");
    expect(caught.variables).toEqual(["OPENROUTER_API_KEY"]);
    expect(caught.message).not.toContain(SECRET_32);
    expect(caught.message).not.toContain(API_KEY);
  });

  it("treats an empty OPENROUTER_API_KEY as missing", () => {
    expect(() => parseEnv(minimalEnv({ OPENROUTER_API_KEY: "" }))).toThrow(EnvError);
    expect(() => parseEnv(minimalEnv({ OPENROUTER_API_KEY: "" }))).toThrow(/OPENROUTER_API_KEY/);
  });

  it("rejects a CASE_SIGNING_SECRET that decodes to 16 bytes and names the variable", () => {
    let caught: unknown;
    try {
      parseEnv(minimalEnv({ CASE_SIGNING_SECRET: SECRET_16 }));
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(EnvError);
    if (!(caught instanceof EnvError)) throw new Error("unreachable");
    expect(caught.variables).toEqual(["CASE_SIGNING_SECRET"]);
    expect(caught.message).toContain("CASE_SIGNING_SECRET");
    expect(caught.message).not.toContain(SECRET_16);
  });

  it("rejects an invalid APP_TIMEZONE", () => {
    expect(() => parseEnv(minimalEnv({ APP_TIMEZONE: "Mars/Olympus_Mons" }))).toThrow(
      /APP_TIMEZONE/,
    );
  });

  it("accepts a valid APP_TIMEZONE override", () => {
    expect(parseEnv(minimalEnv({ APP_TIMEZONE: "UTC" })).appTimezone).toBe("UTC");
  });

  it("applies CASE_BUDGET_MS=1000 when ALLOW_TEST_BUDGET=true", () => {
    const env = parseEnv(minimalEnv({ ALLOW_TEST_BUDGET: "true", CASE_BUDGET_MS: "1000" }));

    expect(env.caseBudgetMs).toBe(1000);
    expect(warn).not.toHaveBeenCalled();
  });

  it("applies CASE_BUDGET_MS=55000 when ALLOW_TEST_BUDGET=true", () => {
    const env = parseEnv(minimalEnv({ ALLOW_TEST_BUDGET: "true", CASE_BUDGET_MS: "55000" }));

    expect(env.caseBudgetMs).toBe(55000);
    expect(warn).not.toHaveBeenCalled();
  });

  it("ignores CASE_BUDGET_MS without the flag and warns exactly once naming the variable", () => {
    const env = parseEnv(minimalEnv({ CASE_BUDGET_MS: "1000" }));

    expect(env.caseBudgetMs).toBe(55000);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("CASE_BUDGET_MS");
  });

  it.each(["999", "55001", "abc"])(
    "ignores out-of-range or invalid CASE_BUDGET_MS=%s with the flag set and warns once",
    (value) => {
      const env = parseEnv(minimalEnv({ ALLOW_TEST_BUDGET: "true", CASE_BUDGET_MS: value }));

      expect(env.caseBudgetMs).toBe(55000);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[0])).toContain("CASE_BUDGET_MS");
    },
  );
});

describe("getEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("reads process.env and memoizes the result", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", API_KEY);
    vi.stubEnv("LLM_MODEL", "openai/gpt-6-luna");
    vi.stubEnv("CASE_SIGNING_SECRET", SECRET_32);

    const mod = await import("@/lib/env");
    const first = mod.getEnv();
    expect(first.models.chat).toBe("openai/gpt-6-luna");
    expect(mod.getEnv()).toBe(first);
  });
});
