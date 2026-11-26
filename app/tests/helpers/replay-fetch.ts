// Replays real OpenRouter HTTP exchanges recorded by scripts/capture-openrouter.ts (T10).
// Injected as `fetch` into the real OpenRouter provider (createModels(env, { fetch })), so the
// provider parses the verbatim recorded response. Only the external LLM is replaced (plan §6a).
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

const CAPTURE_DIR = join(process.cwd(), "tests", "fixtures", "captures", "openrouter");

const ExchangeSchema = z.object({
  request: z.object({ method: z.string(), url: z.string(), body: z.unknown() }),
  response: z.object({ status: z.number(), headers: z.record(z.string(), z.string()), body: z.string() }),
});
export type Exchange = z.infer<typeof ExchangeSchema>;

const CaptureSchema = z.object({
  capture: z.string(),
  capturedAt: z.string(),
  exchanges: z.array(ExchangeSchema),
  sdkResult: z.unknown(),
});
export type Capture = z.infer<typeof CaptureSchema>;

export type CaptureName =
  | "analysis-zwrot-phone-1"
  | "decision-zwrot-phone-1"
  | "analysis-reklamacja-laptop-1"
  | "decision-reklamacja-laptop-1"
  | "chat-text"
  | "chat-tool"
  | "error-401-invalid-key"
  | "error-unknown-model";

export function loadCapture(name: CaptureName): Capture {
  return CaptureSchema.parse(JSON.parse(readFileSync(join(CAPTURE_DIR, `${name}.json`), "utf8")));
}

export type RecordedRequest = { url: string; body: unknown };

export type ReplayOptions = {
  /** Delay before each response is returned (derived variant: "same capture, delayed"). Honors the abort signal. */
  delayMs?: number;
  /** Minimal documented edit of a response body (derived variant). Receives the verbatim body and exchange index. */
  editBody?: (body: string, index: number) => string;
};

/**
 * Returns a `fetch` that answers the N-th call with the N-th recorded exchange (status, headers, body verbatim)
 * and records each outgoing request body (parsed JSON) for assertions.
 */
export function replayFetch(
  exchanges: readonly Exchange[],
  options: ReplayOptions = {},
): { fetch: typeof fetch; requests: RecordedRequest[] } {
  const requests: RecordedRequest[] = [];
  let index = 0;
  const replay: typeof fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    const rawBody = typeof init?.body === "string" ? init.body : "";
    let body: unknown = rawBody;
    try {
      body = JSON.parse(rawBody);
    } catch {
      // keep raw text
    }
    requests.push({ url, body });

    const exchange = exchanges[index];
    const current = index;
    index += 1;
    if (exchange === undefined) throw new Error(`replayFetch: no recorded exchange #${current} (${exchanges.length} recorded)`);

    if (options.delayMs !== undefined && options.delayMs > 0) {
      await delay(options.delayMs, init?.signal ?? undefined);
    }
    const responseBody = options.editBody ? options.editBody(exchange.response.body, current) : exchange.response.body;
    return new Response(responseBody, { status: exchange.response.status, headers: exchange.response.headers });
  };
  return { fetch: replay, requests };
}

function delay(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}
