import { createHmac } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { CASE_TOKEN_TTL_MS, CASE_TOKEN_VERSION, type CaseTokenPayload, DECISION_DISCLAIMER_PL } from "@/lib/domain/schemas";
import { createCaseTokenPayload, signCaseToken, verifyCaseToken } from "@/lib/security/case-token";

// Synthetic values only. 32 bytes of base64 = a valid signing secret.
const SECRET = Buffer.alloc(32, 9).toString("base64");
const OTHER_SECRET = Buffer.alloc(32, 3).toString("base64");
const NOW = new Date("2026-11-26T10:00:00.000Z");
const BASE64URL = /^[A-Za-z0-9_-]+$/;

function buildArgs(): Parameters<typeof createCaseTokenPayload>[0] {
  return {
    caseId: crypto.randomUUID(),
    input: {
      caseType: "zwrot",
      category: "Smartfon",
      model: "Synthetic Model X",
      purchaseDate: "2026-11-21",
      reason: "",
    },
    analysis: {
      photoUsable: true,
      photoProblem: "none",
      itemVisible: true,
      matchesCategory: true,
      signsOfUse: [],
      damages: [],
      probableCause: "not_applicable",
      resellableAsNew: true,
      confidence: "high",
      summaryPl: "Syntetyczne podsumowanie zdjęcia.",
    },
    decision: {
      label: "zaakceptowano",
      justificationPl: "Syntetyczne uzasadnienie decyzji.",
      citedRuleIds: ["Z-1"],
      nextStepsPl: ["Wyślij produkt do serwisu."],
      kind: "initial",
      disclaimerPl: DECISION_DISCLAIMER_PL,
    },
    window: {
      submissionDate: "2026-11-26",
      purchaseDate: "2026-11-21",
      elapsedDays: 5,
      elapsedMonths: 0,
      limitUnit: "days",
      limitValue: 14,
      withinWindow: true,
    },
  };
}

function buildPayload(): CaseTokenPayload {
  return createCaseTokenPayload(buildArgs(), NOW);
}

function base64url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function hmac(payloadB64: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

/** Replaces the first character with a different base64url character (one-character change). */
function flipFirstChar(value: string): string {
  const first = value.charAt(0);
  const replacement = first === "A" ? "B" : "A";
  return replacement + value.slice(1);
}

describe("createCaseTokenPayload", () => {
  it("sets v=1, issuedAt=now and expiresAt=now+2h", () => {
    const payload = buildPayload();
    expect(payload.v).toBe(CASE_TOKEN_VERSION);
    expect(payload.issuedAt).toBe(NOW.getTime());
    expect(payload.expiresAt).toBe(NOW.getTime() + 2 * 60 * 60 * 1000);
    expect(payload.expiresAt - payload.issuedAt).toBe(CASE_TOKEN_TTL_MS);
  });
});

describe("signCaseToken / verifyCaseToken", () => {
  it("round-trips a signed payload with a deep-equal result", () => {
    const payload = buildPayload();
    const token = signCaseToken(payload, SECRET);

    const parts = token.split(".");
    expect(parts).toHaveLength(2);
    for (const part of parts) {
      expect(part).toMatch(BASE64URL);
    }

    const result = verifyCaseToken(token, SECRET, NOW);
    expect(result).toEqual({ ok: true, payload });
  });

  it("rejects a one-character change in the payload part as bad_signature", () => {
    const token = signCaseToken(buildPayload(), SECRET);
    const [payloadB64 = "", signatureB64 = ""] = token.split(".");
    const tampered = `${flipFirstChar(payloadB64)}.${signatureB64}`;

    expect(verifyCaseToken(tampered, SECRET, NOW)).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects a one-character change in the signature part as bad_signature", () => {
    const token = signCaseToken(buildPayload(), SECRET);
    const [payloadB64 = "", signatureB64 = ""] = token.split(".");
    const tampered = `${payloadB64}.${flipFirstChar(signatureB64)}`;

    expect(verifyCaseToken(tampered, SECRET, NOW)).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects a token verified with the wrong secret as bad_signature", () => {
    const token = signCaseToken(buildPayload(), SECRET);

    expect(verifyCaseToken(token, OTHER_SECRET, NOW)).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("reports expired at issuedAt + 2h and ok at issuedAt + 2h - 1 ms", () => {
    const payload = buildPayload();
    const token = signCaseToken(payload, SECRET);
    const expiryInstant = new Date(payload.issuedAt + CASE_TOKEN_TTL_MS);
    const justBeforeExpiry = new Date(payload.issuedAt + CASE_TOKEN_TTL_MS - 1);

    expect(verifyCaseToken(token, SECRET, expiryInstant)).toEqual({ ok: false, reason: "expired" });
    expect(verifyCaseToken(token, SECRET, justBeforeExpiry)).toEqual({ ok: true, payload });
  });

  it("rejects a correctly signed payload with v=2 as unsupported_version", () => {
    const payload = buildPayload();
    const futurePayload = { ...payload, v: 2 };
    const payloadB64 = base64url(JSON.stringify(futurePayload));
    const token = `${payloadB64}.${hmac(payloadB64, SECRET)}`;

    expect(verifyCaseToken(token, SECRET, NOW)).toEqual({ ok: false, reason: "unsupported_version" });
  });

  it("rejects garbage input as malformed", () => {
    expect(verifyCaseToken("", SECRET, NOW)).toEqual({ ok: false, reason: "malformed" });
    expect(verifyCaseToken("abc", SECRET, NOW)).toEqual({ ok: false, reason: "malformed" });
    expect(verifyCaseToken("a.b.c", SECRET, NOW)).toEqual({ ok: false, reason: "malformed" });
  });

  it("rejects a correctly signed non-JSON payload as malformed", () => {
    const payloadB64 = base64url("this is not json {");
    const token = `${payloadB64}.${hmac(payloadB64, SECRET)}`;

    expect(verifyCaseToken(token, SECRET, NOW)).toEqual({ ok: false, reason: "malformed" });
  });

  it("rejects a token longer than 16384 characters as malformed", () => {
    const oversized = "x".repeat(16385);

    expect(verifyCaseToken(oversized, SECRET, NOW)).toEqual({ ok: false, reason: "malformed" });
  });
});
