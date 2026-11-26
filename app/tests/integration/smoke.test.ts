import { describe, expect, it } from "vitest";

describe("integration toolchain smoke", () => {
  it("runs in the node environment without a DOM", () => {
    expect(typeof globalThis.document).toBe("undefined");
  });

  it("blocks real network access (TAC-001-03)", async () => {
    await expect(fetch("https://openrouter.ai/api/v1/models")).rejects.toThrow(
      /network access is disabled/i,
    );
  });
});
