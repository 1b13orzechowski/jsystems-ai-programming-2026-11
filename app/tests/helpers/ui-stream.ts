// Reads an AI SDK UI message stream (SSE `data:` lines) from a Response into parsed JSON chunks.
// Generic on purpose: shared by the /api/case and /api/chat integration tests.
import { z } from "zod";

export type UiChunk = { type: string } & Record<string, unknown>;

const UiChunkSchema = z.looseObject({ type: z.string() });

/** Reads the response body to the end and returns every JSON chunk in order (`data: [DONE]` is skipped). */
export async function readUiStream(response: Response): Promise<UiChunk[]> {
  const text = await response.text();
  const chunks: UiChunk[] = [];

  for (const line of text.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice("data:".length).trim();
    if (payload === "" || payload === "[DONE]") continue;
    chunks.push(UiChunkSchema.parse(JSON.parse(payload)));
  }

  return chunks;
}
