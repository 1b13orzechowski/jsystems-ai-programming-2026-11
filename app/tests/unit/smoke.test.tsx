import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

describe("unit toolchain smoke", () => {
  it("renders a shadcn component through the @ alias with jest-dom matchers", () => {
    render(<Button>Wyślij</Button>);
    expect(screen.getByRole("button", { name: "Wyślij" })).toBeInTheDocument();
  });

  it("blocks real network access (TAC-001-03)", async () => {
    await expect(fetch("https://openrouter.ai/api/v1/models")).rejects.toThrow(
      /network access is disabled/i,
    );
  });
});
