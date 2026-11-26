import "server-only";

// Typed failures of the AI pipeline (ADR-002 §5, P-01, P-04). Messages never carry customer text or provider bodies.
export type ProcessingStep = "validation" | "analysis" | "decision" | "timeout";

export class ProcessingError extends Error {
  readonly step: ProcessingStep;

  constructor(step: ProcessingStep, options?: { cause?: unknown }) {
    super(`Processing failed at ${step}`, options);
    this.name = "ProcessingError";
    this.step = step;
  }
}

export class ChatError extends Error {
  constructor(options?: { cause?: unknown }) {
    super("Chat failed", options);
    this.name = "ChatError";
  }
}

const TIMEOUT_NAMES: ReadonlySet<string> = new Set(["TimeoutError", "AbortError"]);
const MAX_CAUSE_DEPTH = 5;

// The AI SDK aborts with a DOMException named TimeoutError (total timeout) or AbortError (caller signal).
function isTimeoutCause(error: unknown, depth = 0): boolean {
  if (depth > MAX_CAUSE_DEPTH || typeof error !== "object" || error === null) return false;
  if ("name" in error && typeof error.name === "string" && TIMEOUT_NAMES.has(error.name)) return true;
  if ("cause" in error) return isTimeoutCause(error.cause, depth + 1);
  return false;
}

/** Maps any failure of an AI step to a ProcessingError: a timeout or caller abort becomes `timeout`. */
export function processingFailure(
  step: Exclude<ProcessingStep, "timeout" | "validation">,
  cause: unknown,
  signal?: AbortSignal,
): ProcessingError {
  if (signal?.aborted || isTimeoutCause(cause)) return new ProcessingError("timeout", { cause });
  return new ProcessingError(step, { cause });
}
