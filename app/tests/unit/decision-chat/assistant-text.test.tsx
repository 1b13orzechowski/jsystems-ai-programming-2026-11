import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AssistantText } from "@/components/decision-chat/assistant-text";

describe("AssistantText", () => {
  it("renders markdown bold and numbered lists without raw markers (AC-29)", () => {
    const { container } = render(<AssistantText text={"**pogrubienie**\n\n1. krok"} />);
    expect(container.querySelector("strong")?.textContent).toBe("pogrubienie");
    expect(container.querySelector("ol li")?.textContent).toBe("krok");
    expect(container.textContent).not.toContain("**");
  });

  it("renders headings and bullet lists", () => {
    const { container } = render(<AssistantText text={"## Nagłówek\n\n- punkt"} />);
    expect(container.querySelector("h2")?.textContent).toBe("Nagłówek");
    expect(container.querySelector("ul li")?.textContent).toBe("punkt");
    expect(container.textContent).not.toContain("##");
  });

  it("keeps plain text readable", () => {
    render(<AssistantText text="Zwykły tekst odpowiedzi." />);
    expect(screen.getByText("Zwykły tekst odpowiedzi.")).toBeInTheDocument();
  });
});
