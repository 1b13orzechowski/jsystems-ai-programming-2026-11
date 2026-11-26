import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { DECISION_TIMEOUT_MS, decide } from "@/lib/ai/decide";
import { ProcessingError } from "@/lib/ai/errors";
import { createModels } from "@/lib/ai/models";
import { loadPolicy } from "@/lib/ai/policies";
import { ImageAnalysisSchema, type CaseInput, type PolicyWindow } from "@/lib/domain/schemas";

import { type CaptureName, loadCapture, replayFetch } from "../../helpers/replay-fetch";

const MODEL_IDS = { vision: "openai/gpt-6-luna", decision: "openai/gpt-6-luna", chat: "openai/gpt-6-luna" };

// Input and window of capture decision-zwrot-phone-1 (return policy, within the 14-day window).
const ZWROT_INPUT: CaseInput = {
  caseType: "zwrot",
  category: "Smartfon",
  model: "Galaxy S30",
  purchaseDate: "2026-11-26",
  reason: "",
};
const ZWROT_WINDOW: PolicyWindow = {
  submissionDate: "2026-11-26",
  purchaseDate: "2026-11-26",
  elapsedDays: 0,
  elapsedMonths: 0,
  limitUnit: "days",
  limitValue: 14,
  withinWindow: true,
};

// Input and window of capture decision-reklamacja-laptop-1 (complaint policy, within the 24-month period).
const REKLAMACJA_INPUT: CaseInput = {
  caseType: "reklamacja",
  category: "Laptop",
  model: "ThinkBook 14",
  purchaseDate: "2026-01-15",
  reason: "Laptop przestał się ładować po kilku miesiącach normalnego używania.",
};
const REKLAMACJA_WINDOW: PolicyWindow = {
  submissionDate: "2026-11-26",
  purchaseDate: "2026-01-15",
  elapsedDays: 315,
  elapsedMonths: 10,
  limitUnit: "months",
  limitValue: 24,
  withinWindow: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`expected a JSON object: ${label}`);
  return value;
}

// Concatenated text of the user message(s) of the OpenRouter request body (string or text-part content).
function userText(body: unknown): string {
  const record = requireRecord(body, "request body");
  if (!Array.isArray(record.messages)) throw new Error("expected messages array");
  return record.messages
    .filter((message) => isRecord(message) && message.role === "user")
    .map((message) => {
      const content = requireRecord(message, "user message").content;
      if (typeof content === "string") return content;
      if (!Array.isArray(content)) throw new Error("unexpected user content");
      return content.map((part) => (isRecord(part) && typeof part.text === "string" ? part.text : "")).join("");
    })
    .join("\n");
}

function createTestModels(replay: typeof fetch) {
  return createModels({ openRouterApiKey: "test-key-not-sent", models: MODEL_IDS }, { fetch: replay });
}

async function errorOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (caught) {
    return caught;
  }
  throw new Error("expected the call to reject");
}

describe("decide with the real OpenRouter provider and recorded responses", () => {
  // Replays decision-zwrot-phone-1 with the analysis of analysis-zwrot-phone-1 and the return policy.
  it("parses the recorded zwrot decision into the object the SDK returned when recording", async () => {
    const analysisCapture = loadCapture("analysis-zwrot-phone-1");
    const capture = loadCapture("decision-zwrot-phone-1");
    const { fetch, requests } = replayFetch(capture.exchanges);

    const result = await decide({
      caseInput: ZWROT_INPUT,
      analysis: ImageAnalysisSchema.parse(analysisCapture.sdkResult),
      window: ZWROT_WINDOW,
      policy: loadPolicy("zwrot"),
      models: createTestModels(fetch),
    });

    expect(result).toEqual(capture.sdkResult);
    expect(requests).toHaveLength(1);
  });

  // Replays decision-reklamacja-laptop-1 with the analysis of analysis-reklamacja-laptop-1 and the complaint policy.
  it("parses the recorded reklamacja decision and sends the reason only inside <customer_reason>", async () => {
    const analysisCapture = loadCapture("analysis-reklamacja-laptop-1");
    const capture = loadCapture("decision-reklamacja-laptop-1");
    const { fetch, requests } = replayFetch(capture.exchanges);
    const policy = loadPolicy("reklamacja");

    const result = await decide({
      caseInput: REKLAMACJA_INPUT,
      analysis: ImageAnalysisSchema.parse(analysisCapture.sdkResult),
      window: REKLAMACJA_WINDOW,
      policy,
      models: createTestModels(fetch),
    });

    expect(result).toEqual(capture.sdkResult);

    const [request] = requests;
    const body = requireRecord(request?.body, "request body");
    const text = userText(body);
    const reasonBlock = `<customer_reason>\n${REKLAMACJA_INPUT.reason}\n</customer_reason>`;

    expect(text).toContain(reasonBlock);
    expect(JSON.stringify(body).split(REKLAMACJA_INPUT.reason).length - 1).toBe(1);
    expect(text).toContain(`<policy>\n${policy.text}\n</policy>`);

    expect(requireRecord(body.reasoning, "reasoning").effort).toBe("medium");
    expect(requireRecord(body.provider, "provider").require_parameters).toBe(true);
    expect("temperature" in body).toBe(false);
    expect(requireRecord(body.response_format, "response_format").type).toBe("json_schema");
  });

  it("exposes the 25 s decision timeout from ADR-002", () => {
    expect(DECISION_TIMEOUT_MS).toBe(25_000);
  });

  it.each<CaptureName>(["error-401-invalid-key", "error-unknown-model"])(
    "turns the recorded provider error %s into ProcessingError at step decision without provider text",
    async (name) => {
      const analysisCapture = loadCapture("analysis-zwrot-phone-1");
      const capture = loadCapture(name);
      const { fetch } = replayFetch(capture.exchanges);

      const error = await errorOf(
        decide({
          caseInput: ZWROT_INPUT,
          analysis: ImageAnalysisSchema.parse(analysisCapture.sdkResult),
          window: ZWROT_WINDOW,
          policy: loadPolicy("zwrot"),
          models: createTestModels(fetch),
        }),
      );

      expect(error).toBeInstanceOf(ProcessingError);
      if (!(error instanceof ProcessingError)) throw new Error("unreachable");
      expect(error.step).toBe("decision");
      expect(error.message).toBe("Processing failed at decision");
    },
  );
});
