// Machine error codes sent by the API (ADR-003 §5, A-04). The client maps them to Polish copy.
import { literalTuple } from "./categories";
import { COPY } from "./copy-pl";

export const CASE_ERROR_CODES = literalTuple(
  "VALIDATION_FAILED",
  "PROCESSING_FAILED",
  "TIMEOUT",
  "PAYLOAD_TOO_LARGE",
  "UNSUPPORTED_MEDIA_TYPE",
  "CONFIG_ERROR",
);
export type CaseErrorCode = (typeof CASE_ERROR_CODES)[number];

export const CHAT_ERROR_CODES = literalTuple("CHAT_FAILED", "INVALID_MESSAGES", "INVALID_CASE_TOKEN");
export type ChatErrorCode = (typeof CHAT_ERROR_CODES)[number];

export const ERROR_CODES = literalTuple(...CASE_ERROR_CODES, ...CHAT_ERROR_CODES);
export type ErrorCode = (typeof ERROR_CODES)[number];

export function isChatErrorCode(value: string): value is ChatErrorCode {
  return CHAT_ERROR_CODES.some((code) => code === value);
}

/** Any chat failure → AC-28 text; everything else (including unknown codes) → AC-13 banner text. */
export function errorCopyFor(code: string): string {
  return isChatErrorCode(code) ? COPY.chat.error : COPY.errorBanner.message;
}
