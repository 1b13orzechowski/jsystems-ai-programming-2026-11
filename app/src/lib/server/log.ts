import "server-only";

import { literalTuple } from "@/lib/domain/categories";

// ADR-003 §3: structured console logging with allow-listed fields only.
// Customer text, case tokens, photos and provider messages must never reach a log line.

export type LogEvent =
  | "case_received"
  | "case_stage"
  | "case_completed"
  | "case_failed"
  | "chat_received"
  | "chat_completed"
  | "chat_failed"
  | "chat_rejected";

export type LogFields = Partial<{
  caseId: string;
  caseType: string;
  category: string;
  stage: string;
  label: string;
  guardrailApplied: string;
  code: string;
  status: number;
  durationMs: number;
  messageCount: number;
  /** Error class name only (e.g. "TimeoutError"), never the error message. */
  errorName: string;
}>;

const ALLOWED_KEYS = literalTuple(
  "caseId",
  "caseType",
  "category",
  "stage",
  "label",
  "guardrailApplied",
  "code",
  "status",
  "durationMs",
  "messageCount",
  "errorName",
);

const MAX_STRING_LENGTH = 100;

/**
 * Writes one JSON line with `ts`, `event` and the allow-listed fields. Keys outside the allow-list
 * are dropped even when a caller passes them at runtime; strings are cut to 100 characters.
 */
export function logEvent(event: LogEvent, fields: LogFields): void {
  const allowed: Record<string, string | number> = {};
  for (const key of ALLOWED_KEYS) {
    const value = fields[key];
    if (typeof value === "string") allowed[key] = value.slice(0, MAX_STRING_LENGTH);
    else if (typeof value === "number") allowed[key] = value;
  }
  console.info(JSON.stringify({ ts: new Date().toISOString(), event, ...allowed }));
}
