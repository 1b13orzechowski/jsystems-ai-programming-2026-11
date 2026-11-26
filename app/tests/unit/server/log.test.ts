// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { logEvent } from "@/lib/server/log";

// Synthetic values only. The strings below stand in for customer text, tokens and provider details.
const CUSTOMER_TEXT = "Synthetic customer reason 4242";
const TOKEN = "synthetic.token-value";

let infoSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function writtenLine(): string {
  expect(infoSpy).toHaveBeenCalledTimes(1);
  const [line] = infoSpy.mock.calls[0] ?? [];
  if (typeof line !== "string") throw new Error("expected one string log line");
  return line;
}

describe("logEvent", () => {
  it("writes one JSON line with event, ts and the allowed fields", () => {
    logEvent("case_completed", { caseId: "case-1", caseType: "zwrot", durationMs: 1200, status: 200 });

    const parsed = JSON.parse(writtenLine());
    expect(parsed.event).toBe("case_completed");
    expect(Number.isNaN(Date.parse(parsed.ts))).toBe(false);
    expect(parsed).toMatchObject({ caseId: "case-1", caseType: "zwrot", durationMs: 1200, status: 200 });
  });

  it("drops keys outside the allow-list even when passed at runtime", () => {
    const extra: Record<string, unknown> = {
      reason: CUSTOMER_TEXT,
      caseToken: TOKEN,
      message: CUSTOMER_TEXT,
    };
    logEvent("chat_rejected", { code: "INVALID_CASE_TOKEN", ...extra });

    const line = writtenLine();
    expect(line).not.toContain(CUSTOMER_TEXT);
    expect(line).not.toContain(TOKEN);
    const parsed = JSON.parse(line);
    expect(parsed).not.toHaveProperty("reason");
    expect(parsed).not.toHaveProperty("caseToken");
    expect(parsed).not.toHaveProperty("message");
    expect(parsed.code).toBe("INVALID_CASE_TOKEN");
    expect(parsed.event).toBe("chat_rejected");
  });

  it("truncates strings to 100 characters", () => {
    logEvent("case_stage", { stage: "analyzing", label: "x".repeat(250) });

    expect(JSON.parse(writtenLine()).label).toHaveLength(100);
  });

  it("writes only the error class name, never the error message", () => {
    const error = new TypeError(CUSTOMER_TEXT);
    const extra: Record<string, unknown> = { errorMessage: error.message, error };
    logEvent("case_failed", { errorName: error.name, ...extra });

    const line = writtenLine();
    expect(JSON.parse(line).errorName).toBe("TypeError");
    expect(line).not.toContain(CUSTOMER_TEXT);
    expect(line).not.toContain("errorMessage");
  });
});
