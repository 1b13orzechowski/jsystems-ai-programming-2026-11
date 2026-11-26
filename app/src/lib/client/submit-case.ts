// ADR-004 §3.2 / AC-12, AC-13: browser side of POST /api/case.
// Sends the validated case and the downscaled JPEG, reports real stages, and resolves with the case
// result or a machine error code. The caller guarantees one call at a time (AC-09).
import { parseJsonEventStream, uiMessageChunkSchema } from "ai";
import { z } from "zod";

import type { SelectedPhoto } from "@/components/case-form/types";
import { CASE_ERROR_CODES, type CaseErrorCode } from "@/lib/domain/errors";
import { type CaseInput, type CaseResult, type ChatUIMessage, DecisionSchema, StageDataSchema } from "@/lib/domain/schemas";

export const CLIENT_TIMEOUT_MS = 60_000;

export type SubmitCaseResult = { ok: true; result: CaseResult } | { ok: false; code: CaseErrorCode | "NETWORK_ERROR" };

export type SubmitCaseArgs = {
  input: CaseInput;
  photo: Pick<SelectedPhoto, "jpegBlob" | "name">;
  onStage: (stage: "analyzing" | "deciding") => void;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

function isCaseErrorCode(value: string): value is CaseErrorCode {
  return CASE_ERROR_CODES.some((code) => code === value);
}

function isUiMessageLike(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "role" in value &&
    typeof value.role === "string" &&
    "parts" in value &&
    Array.isArray(value.parts) &&
    value.parts.every((part: unknown) => typeof part === "object" && part !== null && "type" in part && typeof part.type === "string")
  );
}

// `firstMessage` is checked structurally (id, role, parts with a type); deeper parts are not re-validated.
const CaseResultSchema = z.object({
  caseId: z.uuid(),
  firstMessage: z.custom<ChatUIMessage>(isUiMessageLike),
  decision: DecisionSchema,
  analysisSummaryPl: z.string(),
  caseToken: z.string().min(1),
});

const ErrorBodySchema = z.object({ error: z.string() });

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function buildForm(input: CaseInput, photo: Pick<SelectedPhoto, "jpegBlob" | "name">): FormData {
  const form = new FormData();
  form.append("caseType", input.caseType);
  form.append("category", input.category);
  form.append("model", input.model);
  form.append("purchaseDate", input.purchaseDate);
  form.append("reason", input.reason);
  form.append("photo", new File([photo.jpegBlob], photo.name, { type: "image/jpeg" }));
  form.append("photoName", photo.name);
  return form;
}

/** HTTP >= 400: the body is `{ error }`; unknown or unreadable bodies fall back to PROCESSING_FAILED. */
async function errorCodeOf(response: Response): Promise<CaseErrorCode> {
  const text = await response.text();
  const parsed = ErrorBodySchema.safeParse(parseJson(text));
  if (parsed.success && isCaseErrorCode(parsed.data.error)) return parsed.data.error;
  return "PROCESSING_FAILED";
}

async function readCaseStream(response: Response, onStage: SubmitCaseArgs["onStage"]): Promise<SubmitCaseResult> {
  if (response.body === null) return { ok: false, code: "PROCESSING_FAILED" };

  const events = parseJsonEventStream({ stream: response.body, schema: uiMessageChunkSchema }).getReader();
  let caseResult: CaseResult | undefined;
  let errorCode: CaseErrorCode | undefined;
  let malformed = false;

  for (;;) {
    const next = await events.read();
    if (next.done) break;
    if (!next.value.success) {
      malformed = true;
      break;
    }
    const chunk = next.value.value;

    if (chunk.type === "data-stage") {
      const stage = StageDataSchema.safeParse(chunk.data);
      if (stage.success) onStage(stage.data.stage);
    } else if (chunk.type === "data-case") {
      const parsed = CaseResultSchema.safeParse(chunk.data);
      if (parsed.success) caseResult = parsed.data;
    } else if (chunk.type === "error") {
      errorCode = isCaseErrorCode(chunk.errorText) ? chunk.errorText : "PROCESSING_FAILED";
    }
  }

  if (errorCode !== undefined) return { ok: false, code: errorCode };
  if (malformed || caseResult === undefined) return { ok: false, code: "PROCESSING_FAILED" };
  return { ok: true, result: caseResult };
}

export async function submitCase({
  input,
  photo,
  onStage,
  fetchImpl = globalThis.fetch,
  timeoutMs = CLIENT_TIMEOUT_MS,
}: SubmitCaseArgs): Promise<SubmitCaseResult> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl("/api/case", {
      method: "POST",
      body: buildForm(input, photo),
      signal: controller.signal,
    });
    if (response.status >= 400) return { ok: false, code: await errorCodeOf(response) };
    return await readCaseStream(response, onStage);
  } catch {
    return { ok: false, code: timedOut ? "TIMEOUT" : "NETWORK_ERROR" };
  } finally {
    clearTimeout(timer);
  }
}
