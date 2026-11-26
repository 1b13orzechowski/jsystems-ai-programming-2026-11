import "server-only";

import { literalTuple } from "@/lib/domain/categories";
import { createCaseInputSchema, type CaseInput } from "@/lib/domain/schemas";

// ADR-003 §3-§5: request guards that run before any LLM call.

export const CASE_BODY_LIMIT_BYTES = 2.2 * 1024 * 1024;
export const CASE_PHOTO_LIMIT_BYTES = 2 * 1024 * 1024;
export const CHAT_BODY_LIMIT_BYTES = 256 * 1024;

const PHOTO_MIME_TYPE = "image/jpeg";
const PHOTO_NAME_MAX_CHARS = 200;
const DEFAULT_PHOTO_NAME = "zdjecie.jpg";
const CASE_FIELD_NAMES = literalTuple("caseType", "category", "model", "purchaseDate", "reason");

export type GuardFailure = {
  status: 400 | 413 | 415;
  code: "VALIDATION_FAILED" | "PAYLOAD_TOO_LARGE" | "UNSUPPORTED_MEDIA_TYPE";
  fields?: string[];
};

export type ParsedCase = { input: CaseInput; photo: Uint8Array; photoName: string };

const UNSUPPORTED_MEDIA: GuardFailure = { status: 415, code: "UNSUPPORTED_MEDIA_TYPE" };
const PAYLOAD_TOO_LARGE: GuardFailure = { status: 413, code: "PAYLOAD_TOO_LARGE" };
const INVALID_FORM: GuardFailure = { status: 400, code: "VALIDATION_FAILED" };

/** Rejects a declared body larger than `limitBytes`. A missing header yields null; later checks still bound the read. */
export function checkContentLength(request: Request, limitBytes: number): GuardFailure | null {
  const header = request.headers.get("content-length");
  if (header === null) return null;
  const declared = Number(header);
  if (!Number.isFinite(declared)) return null;
  return declared > limitBytes ? PAYLOAD_TOO_LARGE : null;
}

export function isMultipart(request: Request): boolean {
  const contentType = request.headers.get("content-type");
  if (contentType === null) return false;
  const mediaType = contentType.split(";")[0]?.trim().toLowerCase();
  return mediaType === "multipart/form-data";
}

/** True when the bytes start with the JPEG SOI marker and the first marker byte (FF D8 FF). */
export function isJpegBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function textField(form: FormData, name: string): string | undefined {
  const value = form.get(name);
  return typeof value === "string" ? value : undefined;
}

function displayPhotoName(form: FormData): string {
  const raw = textField(form, "photoName");
  if (raw === undefined) return DEFAULT_PHOTO_NAME;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return DEFAULT_PHOTO_NAME;
  return Array.from(trimmed).slice(0, PHOTO_NAME_MAX_CHARS).join("");
}

/**
 * Checks the `/api/case` request in ADR-003 order: Content-Length, multipart type, form parse,
 * photo presence, photo size, photo type and JPEG magic bytes, then the case fields via the shared schema.
 */
export async function parseCaseRequest(
  request: Request,
  today: string,
): Promise<{ ok: true; value: ParsedCase } | { ok: false; failure: GuardFailure }> {
  const oversizedBody = checkContentLength(request, CASE_BODY_LIMIT_BYTES);
  if (oversizedBody) return { ok: false, failure: oversizedBody };
  if (!isMultipart(request)) return { ok: false, failure: UNSUPPORTED_MEDIA };

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return { ok: false, failure: INVALID_FORM };
  }

  const photo = form.get("photo");
  if (!(photo instanceof Blob)) {
    return { ok: false, failure: { status: 400, code: "VALIDATION_FAILED", fields: ["photo"] } };
  }
  if (photo.size > CASE_PHOTO_LIMIT_BYTES) return { ok: false, failure: PAYLOAD_TOO_LARGE };

  const bytes = new Uint8Array(await photo.arrayBuffer());
  if (photo.type !== PHOTO_MIME_TYPE || !isJpegBytes(bytes)) {
    return { ok: false, failure: UNSUPPORTED_MEDIA };
  }

  const result = createCaseInputSchema({ today }).safeParse({
    caseType: textField(form, "caseType"),
    category: textField(form, "category"),
    model: textField(form, "model"),
    purchaseDate: textField(form, "purchaseDate"),
    reason: textField(form, "reason"),
  });
  if (!result.success) {
    const invalid = new Set<string>();
    for (const issue of result.error.issues) {
      const [head] = issue.path;
      if (typeof head === "string") invalid.add(head);
    }
    const fields = CASE_FIELD_NAMES.filter((name) => invalid.has(name));
    return { ok: false, failure: { status: 400, code: "VALIDATION_FAILED", fields: [...fields] } };
  }

  return {
    ok: true,
    value: { input: result.data, photo: bytes, photoName: displayPhotoName(form) },
  };
}

/** JSON error response with the status from the failure and `Cache-Control: no-store` (ADR-003 §5). */
export function failureResponse(failure: GuardFailure): Response {
  const body = failure.fields
    ? { error: failure.code, fields: failure.fields }
    : { error: failure.code };
  return Response.json(body, { status: failure.status, headers: { "Cache-Control": "no-store" } });
}
