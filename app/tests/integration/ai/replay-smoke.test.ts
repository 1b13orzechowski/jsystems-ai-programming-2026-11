import { generateText, Output } from "ai";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createModels } from "@/lib/ai/models";
import { ImageAnalysisSchema } from "@/lib/domain/schemas";

import { loadCapture, replayFetch } from "../../helpers/replay-fetch";

// Proves the replay approach: the real OpenRouter provider parses a verbatim recorded response.
describe("replayFetch with the real OpenRouter provider", () => {
  it("parses the recorded analysis response into the same object the SDK returned when recording", async () => {
    const capture = loadCapture("analysis-zwrot-phone-1");
    const { fetch, requests } = replayFetch(capture.exchanges);
    const models = createModels(
      { openRouterApiKey: "test-key-not-sent", models: { vision: "openai/gpt-6-luna", decision: "openai/gpt-6-luna", chat: "openai/gpt-6-luna" } },
      { fetch },
    );

    const result = await generateText({
      model: models.vision,
      prompt: "replay",
      output: Output.object({ schema: ImageAnalysisSchema }),
    });

    expect(result.output).toEqual(capture.sdkResult);
    expect(requests).toHaveLength(1);
  });
});
