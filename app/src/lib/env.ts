import "server-only";

import { z } from "zod";

// ADR-000 §7 environment variables. Empty strings count as unset (ADR-001 §8).
// Error messages name variables only; values are never printed.

export type AppEnv = {
  openRouterApiKey: string;
  models: { vision: string; decision: string; chat: string };
  caseSigningSecret: string;
  appTimezone: string;
  caseBudgetMs: number; // 55000 unless the valid test override applies
};

export const DEFAULT_CASE_BUDGET_MS = 55_000;

const DEFAULT_TIMEZONE = "Europe/Warsaw";
const MIN_TEST_BUDGET_MS = 1000;
const MIN_SECRET_BYTES = 32;

export class EnvError extends Error {
  readonly variables: string[];

  constructor(variables: string[]) {
    super(`Missing or invalid environment variables: ${variables.join(", ")}`);
    this.name = "EnvError";
    this.variables = variables;
  }
}

function isValidTimeZone(zone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: zone }).resolvedOptions();
    return true;
  } catch {
    return false;
  }
}

const nonEmptyString = z.string().min(1);

// `openssl rand -base64 32` output: base64 alphabet with optional padding.
const signingSecret = z
  .string()
  .regex(/^[A-Za-z0-9+/]+={0,2}$/)
  .refine((value) => Buffer.from(value, "base64").byteLength >= MIN_SECRET_BYTES);

const timeZone = z.string().refine(isValidTimeZone);

const envSchema = z.object({
  OPENROUTER_API_KEY: nonEmptyString,
  LLM_MODEL: nonEmptyString,
  VISION_MODEL: nonEmptyString.optional(),
  DECISION_MODEL: nonEmptyString.optional(),
  CHAT_MODEL: nonEmptyString.optional(),
  CASE_SIGNING_SECRET: signingSecret,
  APP_TIMEZONE: timeZone.optional(),
});

const caseBudgetSchema = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().min(MIN_TEST_BUDGET_MS).max(DEFAULT_CASE_BUDGET_MS));

const VARIABLE_NAMES: readonly string[] = [
  "OPENROUTER_API_KEY",
  "LLM_MODEL",
  "VISION_MODEL",
  "DECISION_MODEL",
  "CHAT_MODEL",
  "CASE_SIGNING_SECRET",
  "APP_TIMEZONE",
];

function readNormalized(source: Record<string, string | undefined>, name: string): string | undefined {
  const value = source[name];
  return value === undefined || value.trim() === "" ? undefined : value;
}

// ADR-003 A-05: CASE_BUDGET_MS applies only with ALLOW_TEST_BUDGET=true and an integer in range.
// Anything else is ignored with a single warning that names the variable.
function resolveCaseBudgetMs(source: Record<string, string | undefined>): number {
  const raw = readNormalized(source, "CASE_BUDGET_MS");
  if (raw === undefined) return DEFAULT_CASE_BUDGET_MS;

  const testFlagSet = readNormalized(source, "ALLOW_TEST_BUDGET") === "true";
  const parsed = caseBudgetSchema.safeParse(raw);
  if (testFlagSet && parsed.success) return parsed.data;

  console.warn(
    "CASE_BUDGET_MS ignored: it needs ALLOW_TEST_BUDGET=true and an integer from 1000 to 55000.",
  );
  return DEFAULT_CASE_BUDGET_MS;
}

// Pure apart from the single CASE_BUDGET_MS warning. Throws EnvError naming invalid or missing variables.
export function parseEnv(source: Record<string, string | undefined>): AppEnv {
  const normalized: Record<string, string | undefined> = {};
  for (const name of VARIABLE_NAMES) {
    normalized[name] = readNormalized(source, name);
  }

  const result = envSchema.safeParse(normalized);
  if (!result.success) {
    const names = new Set(result.error.issues.map((issue) => String(issue.path[0])));
    throw new EnvError(VARIABLE_NAMES.filter((name) => names.has(name)));
  }

  const data = result.data;
  const chatModel = data.LLM_MODEL;

  return {
    openRouterApiKey: data.OPENROUTER_API_KEY,
    models: {
      vision: data.VISION_MODEL ?? chatModel,
      decision: data.DECISION_MODEL ?? chatModel,
      chat: data.CHAT_MODEL ?? chatModel,
    },
    caseSigningSecret: data.CASE_SIGNING_SECRET,
    appTimezone: data.APP_TIMEZONE ?? DEFAULT_TIMEZONE,
    caseBudgetMs: resolveCaseBudgetMs(source),
  };
}

let cachedEnv: AppEnv | undefined;

// Memoized parseEnv(process.env). A failed parse is not cached, so the next call re-validates.
export function getEnv(): AppEnv {
  if (cachedEnv === undefined) {
    cachedEnv = parseEnv(process.env);
  }
  return cachedEnv;
}
