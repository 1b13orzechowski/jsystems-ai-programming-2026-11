import "server-only";

import { generateText, Output } from "ai";

import { type CaseInput, type ImageAnalysis, ImageAnalysisSchema } from "@/lib/domain/schemas";

import { processingFailure } from "./errors";
import { type ModelSet, OPENROUTER_PROVIDER_OPTIONS } from "./models";
import { buildAnalysisInstructions, buildAnalysisUserText } from "./prompts/analysis";

// ADR-002 §3.1: one vision call, at most 25 s in total.
export const ANALYSIS_TIMEOUT_MS = 25_000;

export async function analyzeImage(args: {
  caseInput: CaseInput;
  jpegBytes: Uint8Array;
  models: ModelSet;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<ImageAnalysis> {
  const { caseInput, jpegBytes, models, signal, timeoutMs = ANALYSIS_TIMEOUT_MS } = args;

  try {
    // The text part precedes the image. The reason is not part of the input (P-04).
    const result = await generateText({
      model: models.vision,
      instructions: buildAnalysisInstructions(caseInput.caseType),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: buildAnalysisUserText(caseInput) },
            { type: "file", mediaType: "image/jpeg", data: jpegBytes },
          ],
        },
      ],
      output: Output.object({ schema: ImageAnalysisSchema }),
      maxOutputTokens: 1200,
      maxRetries: 1,
      timeout: { totalMs: timeoutMs },
      abortSignal: signal,
      providerOptions: OPENROUTER_PROVIDER_OPTIONS.analysis,
    });
    return result.output;
  } catch (cause) {
    throw processingFailure("analysis", cause, signal);
  }
}
