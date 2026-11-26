import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import {
  CASE_TOKEN_TTL_MS,
  CASE_TOKEN_VERSION,
  CaseTokenPayloadSchema,
  type CaseTokenPayload,
} from "@/lib/domain/schemas";

// ADR-003 §4: stateless, tamper-evident token = base64url(JSON payload) + "." + base64url(HMAC-SHA256).
// The payload is readable by the client; it is signed, not encrypted.

const MAX_TOKEN_LENGTH = 16 * 1024;

export type CaseTokenFailure = "malformed" | "bad_signature" | "expired" | "unsupported_version";
export type VerifyResult = { ok: true; payload: CaseTokenPayload } | { ok: false; reason: CaseTokenFailure };

/** Builds a payload with the version and the 2-hour validity window (epoch ms). */
export function createCaseTokenPayload(
  args: Omit<CaseTokenPayload, "v" | "issuedAt" | "expiresAt">,
  now: Date,
): CaseTokenPayload {
  const issuedAt = now.getTime();
  return {
    v: CASE_TOKEN_VERSION,
    ...args,
    issuedAt,
    expiresAt: issuedAt + CASE_TOKEN_TTL_MS,
  };
}

function sign(payloadB64: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadB64, "utf8").digest("base64url");
}

export function signCaseToken(payload: CaseTokenPayload, secret: string): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${payloadB64}.${sign(payloadB64, secret)}`;
}

export function verifyCaseToken(token: string, secret: string, now: Date): VerifyResult {
  if (token.length > MAX_TOKEN_LENGTH) return { ok: false, reason: "malformed" };

  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const [payloadB64 = "", signatureB64 = ""] = parts;

  const expected = Buffer.from(sign(payloadB64, secret), "utf8");
  const received = Buffer.from(signatureB64, "utf8");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return { ok: false, reason: "bad_signature" };
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (typeof decoded === "object" && decoded !== null && "v" in decoded && decoded.v !== CASE_TOKEN_VERSION) {
    return { ok: false, reason: "unsupported_version" };
  }

  const parsed = CaseTokenPayloadSchema.safeParse(decoded);
  if (!parsed.success) return { ok: false, reason: "malformed" };

  if (now.getTime() >= parsed.data.expiresAt) return { ok: false, reason: "expired" };

  return { ok: true, payload: parsed.data };
}
