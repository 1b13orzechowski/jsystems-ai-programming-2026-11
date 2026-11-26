// ADR-004 §3.2 / AC-12, AC-13, TAC-004-02: client reader of POST /api/case.
// `fetch` is replaced by a replay of real route captures (tests/fixtures/captures/api-case, recorded
// 2026-11-26). Derived variants are built in the test and listed in tests/fixtures/captures/README.md.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { CLIENT_TIMEOUT_MS, submitCase } from "@/lib/client/submit-case";
import type { CaseInput } from "@/lib/domain/schemas";

const CaptureSchema = z.object({
  request: z.unknown(),
  response: z.object({
    status: z.number(),
    headers: z.record(z.string(), z.string()),
    body: z.string(),
  }),
});

function loadCapture(name: string) {
  const path = join(process.cwd(), "tests", "fixtures", "captures", "api-case", `${name}.json`);
  return CaptureSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}

/** Parses the `data: {...}` lines of a recorded UI message stream (the `[DONE]` line is skipped). */
function sseEvents(text: string): unknown[] {
  return text
    .split("\n")
    .filter((line) => line.startsWith("data: ") && line !== "data: [DONE]")
    .map((line) => JSON.parse(line.slice("data: ".length)));
}

function dataCaseOf(text: string): unknown {
  const event = sseEvents(text).find((item) => {
    return typeof item === "object" && item !== null && "type" in item && item.type === "data-case";
  });
  if (event === undefined) throw new Error("capture has no data-case event");
  return event;
}

/** `fetch` that answers with the recorded status, headers and body of a capture. */
function replayCapture(name: string, bodyOverride?: string): typeof fetch {
  const capture = loadCapture(name);
  const body = bodyOverride ?? capture.response.body;
  return async () => new Response(body, { status: capture.response.status, headers: capture.response.headers });
}

const zwrotInput: CaseInput = {
  caseType: "zwrot",
  category: "Smartfon",
  model: "Galaxy S30",
  purchaseDate: "2026-11-23",
  reason: "",
};

const reklamacjaInput: CaseInput = {
  caseType: "reklamacja",
  category: "Laptop",
  model: "ThinkBook 14",
  purchaseDate: "2025-12-31",
  reason: "Laptop przestał się ładować po kilku miesiącach normalnego używania.",
};

const phoneJpegPath = join(process.cwd(), "..", "assets", "example-images", "phone-1.jpg");

function phonePhoto() {
  return { jpegBlob: new Blob([readFileSync(phoneJpegPath)], { type: "image/jpeg" }), name: "phone-1.jpg" };
}

describe("submitCase (ADR-004 §3.2)", () => {
  it("exposes the 60 s client timeout from the spec", () => {
    expect(CLIENT_TIMEOUT_MS).toBe(60_000);
  });

  it("replays the zwrot success capture: stages in order and the recorded data-case payload", async () => {
    const stages: string[] = [];
    const capture = loadCapture("success-zwrot-phone-1");

    const result = await submitCase({
      input: zwrotInput,
      photo: phonePhoto(),
      onStage: (stage) => stages.push(stage),
      fetchImpl: replayCapture("success-zwrot-phone-1"),
    });

    expect(stages).toEqual(["analyzing", "deciding"]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const recorded = dataCaseOf(capture.response.body);
    expect(typeof recorded === "object" && recorded !== null && "data" in recorded).toBe(true);
    expect(result.result).toEqual(
      typeof recorded === "object" && recorded !== null && "data" in recorded ? recorded.data : undefined,
    );
  });

  it("replays the reklamacja success capture: stages in order and the recorded data-case payload", async () => {
    const stages: string[] = [];
    const capture = loadCapture("success-reklamacja-laptop-1");
    const photo = { jpegBlob: new Blob([readFileSync(phoneJpegPath)], { type: "image/jpeg" }), name: "laptop-1.png" };

    const result = await submitCase({
      input: reklamacjaInput,
      photo,
      onStage: (stage) => stages.push(stage),
      fetchImpl: replayCapture("success-reklamacja-laptop-1"),
    });

    expect(stages).toEqual(["analyzing", "deciding"]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const recorded = dataCaseOf(capture.response.body);
    expect(typeof recorded === "object" && recorded !== null && "data" in recorded ? recorded.data : undefined).toEqual(
      result.result,
    );
    expect(result.result.decision.disclaimerPl).toContain("wstępna decyzja");
  });

  it("maps the recorded 400 validation response to VALIDATION_FAILED", async () => {
    const stages: string[] = [];
    const result = await submitCase({
      input: { ...zwrotInput, model: "" },
      photo: phonePhoto(),
      onStage: (stage) => stages.push(stage),
      fetchImpl: replayCapture("validation-400"),
    });

    expect(result).toEqual({ ok: false, code: "VALIDATION_FAILED" });
    expect(stages).toEqual([]);
  });

  it("maps the recorded 415 response to UNSUPPORTED_MEDIA_TYPE", async () => {
    const result = await submitCase({
      input: zwrotInput,
      photo: phonePhoto(),
      onStage: () => undefined,
      fetchImpl: replayCapture("unsupported-media-415"),
    });

    expect(result).toEqual({ ok: false, code: "UNSUPPORTED_MEDIA_TYPE" });
  });

  it("reports the analyzing stage, then PROCESSING_FAILED from the invalid-key stream capture", async () => {
    const stages: string[] = [];
    const result = await submitCase({
      input: zwrotInput,
      photo: phonePhoto(),
      onStage: (stage) => stages.push(stage),
      fetchImpl: replayCapture("processing-failed-invalid-key"),
    });

    expect(stages).toEqual(["analyzing"]);
    expect(result).toEqual({ ok: false, code: "PROCESSING_FAILED" });
  });

  it("returns PROCESSING_FAILED when the stream ends before data-case (derived: success capture cut before data-case)", async () => {
    const capture = loadCapture("success-zwrot-phone-1");
    const cut = capture.response.body.slice(0, capture.response.body.indexOf('data: {"type":"data-case"'));
    expect(cut).toContain('"stage":"deciding"');
    expect(cut).not.toContain("data-case");

    const stages: string[] = [];
    const result = await submitCase({
      input: zwrotInput,
      photo: phonePhoto(),
      onStage: (stage) => stages.push(stage),
      fetchImpl: replayCapture("success-zwrot-phone-1", cut),
    });

    expect(stages).toEqual(["analyzing", "deciding"]);
    expect(result).toEqual({ ok: false, code: "PROCESSING_FAILED" });
  });

  it("aborts the request after timeoutMs and returns TIMEOUT (derived: success capture delayed past the timeout)", async () => {
    const capture = loadCapture("success-zwrot-phone-1");
    const encoder = new TextEncoder();
    let receivedSignal: AbortSignal | undefined;

    const delayedFetch: typeof fetch = async (_input, init) => {
      receivedSignal = init?.signal ?? undefined;
      const signal = receivedSignal;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          const timer = setTimeout(() => {
            controller.enqueue(encoder.encode(capture.response.body));
            controller.close();
          }, 1_000);
          signal?.addEventListener("abort", () => {
            clearTimeout(timer);
            controller.error(new DOMException("The operation was aborted.", "AbortError"));
          });
        },
      });
      return new Response(body, { status: 200, headers: capture.response.headers });
    };

    const stages: string[] = [];
    const result = await submitCase({
      input: zwrotInput,
      photo: phonePhoto(),
      onStage: (stage) => stages.push(stage),
      fetchImpl: delayedFetch,
      timeoutMs: 50,
    });

    expect(result).toEqual({ ok: false, code: "TIMEOUT" });
    expect(stages).toEqual([]);
    expect(receivedSignal?.aborted).toBe(true);
  });

  it("maps a rejected fetch (offline) to NETWORK_ERROR", async () => {
    const offlineFetch: typeof fetch = async () => {
      throw new TypeError("Failed to fetch");
    };

    const result = await submitCase({
      input: zwrotInput,
      photo: phonePhoto(),
      onStage: () => undefined,
      fetchImpl: offlineFetch,
    });

    expect(result).toEqual({ ok: false, code: "NETWORK_ERROR" });
  });

  it("sends a multipart FormData with the six text fields and a downscaled JPEG photo (TAC-004-02)", async () => {
    let sentBody: BodyInit | null | undefined;
    let sentUrl: string | URL | Request | undefined;
    const recordingFetch: typeof fetch = async (input, init) => {
      sentUrl = input;
      sentBody = init?.body;
      return replayCapture("success-zwrot-phone-1")(input, init);
    };

    await submitCase({
      input: zwrotInput,
      photo: phonePhoto(),
      onStage: () => undefined,
      fetchImpl: recordingFetch,
    });

    expect(sentUrl).toBe("/api/case");
    expect(sentBody).toBeInstanceOf(FormData);
    if (!(sentBody instanceof FormData)) return;

    expect(sentBody.get("caseType")).toBe("zwrot");
    expect(sentBody.get("category")).toBe("Smartfon");
    expect(sentBody.get("model")).toBe("Galaxy S30");
    expect(sentBody.get("purchaseDate")).toBe("2026-11-23");
    expect(sentBody.get("reason")).toBe("");
    expect(sentBody.get("photoName")).toBe("phone-1.jpg");

    const photo = sentBody.get("photo");
    expect(photo).toBeInstanceOf(File);
    if (!(photo instanceof File)) return;
    expect(photo.name).toBe("phone-1.jpg");
    expect(photo.type).toBe("image/jpeg");
    expect(photo.size).toBeGreaterThan(0);
    expect(photo.size).toBeLessThanOrEqual(1.5 * 1024 * 1024);
  });
});
