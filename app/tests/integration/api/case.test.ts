import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));

import { DecisionSchema } from "@/lib/domain/schemas";
import { todayInTimeZone } from "@/lib/domain/policy-window";
import { verifyCaseToken } from "@/lib/security/case-token";

import { type Exchange, type ReplayOptions, loadCapture, replayFetch } from "../../helpers/replay-fetch";
import { readUiStream, type UiChunk } from "../../helpers/ui-stream";

// ADR-003 §3-§5, §8 (T13). The route is called directly; the LLM is the real OpenRouter provider
// fed by a replay of the real captures in tests/fixtures/captures/openrouter/.

const SECRET = Buffer.alloc(32, 5).toString("base64");
const MODEL = "openai/gpt-6-luna";
const TIME_ZONE = "Europe/Warsaw";
const MB = 1024 * 1024;
const ASSETS_DIR = join(process.cwd(), "..", "assets", "example-images");

const PHONE_JPEG = new Uint8Array(readFileSync(join(ASSETS_DIR, "phone-1.jpg")));
const LAPTOP_WEBP = new Uint8Array(readFileSync(join(ASSETS_DIR, "laptop-2.webp")));

const REKLAMACJA_REASON = "Laptop przestał się ładować po kilku miesiącach normalnego używania.";

const BASE_ENV: Record<string, string> = {
  OPENROUTER_API_KEY: "test-key-not-sent",
  LLM_MODEL: MODEL,
  CASE_SIGNING_SECRET: SECRET,
  APP_TIMEZONE: TIME_ZONE,
  VISION_MODEL: "",
  DECISION_MODEL: "",
  CHAT_MODEL: "",
  CASE_BUDGET_MS: "",
  ALLOW_TEST_BUDGET: "",
};

const CaseStageChunk = z.looseObject({
  type: z.literal("data-stage"),
  data: z.object({ stage: z.enum(["analyzing", "deciding"]) }),
});

const CaseDataChunk = z.looseObject({
  type: z.literal("data-case"),
  data: z.object({
    caseId: z.uuid(),
    firstMessage: z.looseObject({ parts: z.array(z.looseObject({ type: z.string() })) }),
    decision: DecisionSchema,
    analysisSummaryPl: z.string().min(1),
    caseToken: z.string().min(1),
  }),
});

const ErrorChunk = z.looseObject({ type: z.literal("error"), errorText: z.string() });

/** Loads a fresh route module with the given env. `getEnv` memoizes, so every env variant re-imports. */
async function loadRoute(env: Record<string, string>, exchanges: readonly Exchange[], options?: ReplayOptions) {
  vi.unstubAllEnvs();
  for (const [name, value] of Object.entries({ ...BASE_ENV, ...env })) {
    vi.stubEnv(name, value);
  }
  vi.resetModules();

  const replay = replayFetch(exchanges, options);
  const models = await import("@/lib/ai/models");
  models.setModelsForTesting(
    models.createModels(
      { openRouterApiKey: "test-key-not-sent", models: { vision: MODEL, decision: MODEL, chat: MODEL } },
      { fetch: replay.fetch },
    ),
  );

  const route = await import("@/app/api/case/route");
  return { POST: route.POST, requests: replay.requests };
}

type FormFields = { caseType: string; category: string; model: string; purchaseDate: string; reason: string };

const HAPPY_ZWROT: FormFields = {
  caseType: "zwrot",
  category: "Smartfon",
  model: "Galaxy S30",
  purchaseDate: warsawDate(0),
  reason: "",
};

/** Warsaw calendar date `days` away from today (a 24 h step always moves the Warsaw date by one day). */
function warsawDate(days: number): string {
  return todayInTimeZone(new Date(Date.now() + days * 24 * 60 * 60 * 1000), TIME_ZONE);
}

function caseRequest(
  fields: Partial<Record<keyof FormFields, string | undefined>>,
  photo: Blob | null = new File([PHONE_JPEG], "phone-1.jpg", { type: "image/jpeg" }),
): Request {
  const form = new FormData();
  const merged = { ...HAPPY_ZWROT, ...fields };
  for (const [name, value] of Object.entries(merged)) {
    if (value !== undefined) form.set(name, value);
  }
  if (photo) form.set("photo", photo, "photo.jpg");
  return new Request("http://localhost/api/case", { method: "POST", body: form });
}

const zwrotExchanges = [
  ...loadCapture("analysis-zwrot-phone-1").exchanges,
  ...loadCapture("decision-zwrot-phone-1").exchanges,
];
const reklamacjaExchanges = [
  ...loadCapture("analysis-reklamacja-laptop-1").exchanges,
  ...loadCapture("decision-reklamacja-laptop-1").exchanges,
];

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/case happy paths", () => {
  it("streams analyzing then deciding, then one data-case with a verifiable token (zwrot)", async () => {
    const { POST, requests } = await loadRoute({}, zwrotExchanges);

    const response = await POST(caseRequest(HAPPY_ZWROT));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    const chunks: UiChunk[] = await readUiStream(response);
    const stages = chunks.filter((chunk) => chunk.type === "data-stage").map((chunk) => CaseStageChunk.parse(chunk).data.stage);
    expect(stages).toEqual(["analyzing", "deciding"]);

    const caseChunks = chunks.filter((chunk) => chunk.type === "data-case");
    expect(caseChunks).toHaveLength(1);
    expect(chunks.some((chunk) => chunk.type === "error")).toBe(false);

    const { data } = CaseDataChunk.parse(caseChunks[0]);
    expect(data.firstMessage.parts[0]?.type).toBe("text");
    expect(data.firstMessage.parts[1]?.type).toBe("data-decision");

    const verified = verifyCaseToken(data.caseToken, SECRET, new Date());
    expect(verified.ok).toBe(true);

    expect(requests).toHaveLength(2);
  });

  it("completes the complaint flow with the laptop-1 captures", async () => {
    const { POST, requests } = await loadRoute({}, reklamacjaExchanges);

    const response = await POST(
      caseRequest({
        caseType: "reklamacja",
        category: "Laptop",
        model: "ThinkBook 14",
        purchaseDate: warsawDate(-120),
        reason: REKLAMACJA_REASON,
      }),
    );
    expect(response.status).toBe(200);

    const chunks = await readUiStream(response);
    const caseChunks = chunks.filter((chunk) => chunk.type === "data-case");
    expect(caseChunks).toHaveLength(1);
    const { data } = CaseDataChunk.parse(caseChunks[0]);
    expect(data.decision.guardrailApplied).not.toBe("window_expired");
    expect(verifyCaseToken(data.caseToken, SECRET, new Date()).ok).toBe(true);
    expect(requests).toHaveLength(2);
  });

  it("applies guardrail window_expired when the return window has passed", async () => {
    const { POST } = await loadRoute({}, zwrotExchanges);

    const response = await POST(caseRequest({ purchaseDate: warsawDate(-30) }));
    const chunks = await readUiStream(response);
    const { data } = CaseDataChunk.parse(chunks.find((chunk) => chunk.type === "data-case"));

    expect(data.decision.label).toBe("odrzucono");
    expect(data.decision.guardrailApplied).toBe("window_expired");
  });
});

describe("POST /api/case validation (400/413/415, no LLM call)", () => {
  it("rejects a missing model with VALIDATION_FAILED and makes no replay request", async () => {
    const { POST, requests } = await loadRoute({}, zwrotExchanges);

    const response = await POST(caseRequest({ model: undefined }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "VALIDATION_FAILED", fields: ["model"] });
    expect(requests).toHaveLength(0);
  });

  it("rejects a complaint reason shorter than 10 non-whitespace characters", async () => {
    const { POST, requests } = await loadRoute({}, reklamacjaExchanges);

    const response = await POST(
      caseRequest({ caseType: "reklamacja", category: "Laptop", purchaseDate: warsawDate(-10), reason: "abc" }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "VALIDATION_FAILED", fields: ["reason"] });
    expect(requests).toHaveLength(0);
  });

  it("rejects a purchase date after today in Warsaw", async () => {
    const { POST, requests } = await loadRoute({}, zwrotExchanges);

    const response = await POST(caseRequest({ purchaseDate: warsawDate(1) }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "VALIDATION_FAILED", fields: ["purchaseDate"] });
    expect(requests).toHaveLength(0);
  });

  it("rejects WebP bytes labelled image/jpeg with 415", async () => {
    const { POST, requests } = await loadRoute({}, zwrotExchanges);

    const response = await POST(
      caseRequest({}, new File([LAPTOP_WEBP], "laptop-2.jpg", { type: "image/jpeg" })),
    );
    expect(response.status).toBe(415);
    expect(await response.json()).toEqual({ error: "UNSUPPORTED_MEDIA_TYPE" });
    expect(requests).toHaveLength(0);
  });

  it("rejects a photo above 2 MB with 413", async () => {
    const { POST, requests } = await loadRoute({}, zwrotExchanges);

    const repeats = Math.ceil((2.1 * MB) / PHONE_JPEG.length);
    const oversized = new Uint8Array(PHONE_JPEG.length * repeats);
    for (let index = 0; index < repeats; index += 1) oversized.set(PHONE_JPEG, index * PHONE_JPEG.length);

    const response = await POST(caseRequest({}, new File([oversized], "big.jpg", { type: "image/jpeg" })));
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "PAYLOAD_TOO_LARGE" });
    expect(requests).toHaveLength(0);
  });

  it("rejects application/json with 415", async () => {
    const { POST, requests } = await loadRoute({}, zwrotExchanges);

    const response = await POST(
      new Request("http://localhost/api/case", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(HAPPY_ZWROT),
      }),
    );
    expect(response.status).toBe(415);
    expect(await response.json()).toEqual({ error: "UNSUPPORTED_MEDIA_TYPE" });
    expect(requests).toHaveLength(0);
  });
});

describe("POST /api/case failures inside the stream", () => {
  it("ends the stream with only PROCESSING_FAILED when analysis fails at the provider", async () => {
    const { POST } = await loadRoute({}, loadCapture("error-401-invalid-key").exchanges);

    const response = await POST(caseRequest(HAPPY_ZWROT));
    expect(response.status).toBe(200);

    const raw = await response.clone().text();
    const chunks = await readUiStream(response);

    const errors = chunks.filter((chunk) => chunk.type === "error").map((chunk) => ErrorChunk.parse(chunk));
    expect(errors.map((error) => error.errorText)).toEqual(["PROCESSING_FAILED"]);
    expect(chunks.some((chunk) => chunk.type === "data-case")).toBe(false);
    expect(raw).not.toMatch(/openrouter|Missing Authentication|401|unauthorized|stack|\bat\s+\S+\s+\(/i);
  });

  it("ends the stream with TIMEOUT when the case budget elapses before the provider answers", async () => {
    const { POST } = await loadRoute(
      { ALLOW_TEST_BUDGET: "true", CASE_BUDGET_MS: "1000" },
      loadCapture("analysis-zwrot-phone-1").exchanges,
      { delayMs: 3000 },
    );

    const started = Date.now();
    const response = await POST(caseRequest(HAPPY_ZWROT));
    const chunks = await readUiStream(response);
    const elapsed = Date.now() - started;

    const errors = chunks.filter((chunk) => chunk.type === "error").map((chunk) => ErrorChunk.parse(chunk));
    expect(errors.map((error) => error.errorText)).toEqual(["TIMEOUT"]);
    expect(chunks.some((chunk) => chunk.type === "data-case")).toBe(false);
    // Budget is 1 s; the 3 s delayed replay must not be waited for. Allow slack for a loaded machine.
    expect(elapsed).toBeLessThan(2000);
  });
});

describe("POST /api/case configuration", () => {
  it("returns 500 CONFIG_ERROR without values when the signing secret is missing", async () => {
    const { POST, requests } = await loadRoute({ CASE_SIGNING_SECRET: "" }, zwrotExchanges);

    const response = await POST(caseRequest(HAPPY_ZWROT));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "CONFIG_ERROR" });
    expect(requests).toHaveLength(0);
  });
});

describe("POST /api/case logging", () => {
  it("logs case_completed with caseId and label, never the reason text or the token", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const { POST } = await loadRoute({}, reklamacjaExchanges);

    const response = await POST(
      caseRequest({
        caseType: "reklamacja",
        category: "Laptop",
        model: "ThinkBook 14",
        purchaseDate: warsawDate(-120),
        reason: REKLAMACJA_REASON,
      }),
    );
    const chunks = await readUiStream(response);
    const { data } = CaseDataChunk.parse(chunks.find((chunk) => chunk.type === "data-case"));

    const lines = info.mock.calls.map((call) => String(call[0]));
    const completed = lines
      .filter((line) => line.includes('"event":"case_completed"'))
      .map((line) => z.looseObject({ event: z.literal("case_completed"), caseId: z.string(), label: z.string() }).parse(JSON.parse(line)));

    expect(completed).toHaveLength(1);
    expect(completed[0]?.caseId).toBe(data.caseId);
    expect(completed[0]?.label).toBe(data.decision.label);

    const everything = lines.join("\n");
    expect(everything).not.toContain("Laptop przestał się ładować");
    expect(everything).not.toContain(data.caseToken);
  });
});
