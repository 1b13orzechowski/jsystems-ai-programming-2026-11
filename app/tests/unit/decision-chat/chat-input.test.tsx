import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChatInput } from "@/components/decision-chat/chat-input";
import { COPY } from "@/lib/domain/copy-pl";
import { CHAT_MESSAGE_MAX } from "@/lib/domain/schemas";

function setup(disabled = false) {
  const onSend = vi.fn<(text: string) => void>();
  const user = userEvent.setup();
  render(<ChatInput disabled={disabled} onSend={onSend} />);
  return { onSend, user, input: screen.getByRole("textbox", { name: COPY.chat.inputLabel }) };
}

describe("ChatInput", () => {
  it("does not send whitespace-only text (AC-22)", async () => {
    const { onSend, user, input } = setup();
    await user.type(input, "   {Enter}");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("sends trimmed text on Enter and clears the field", async () => {
    const { onSend, user, input } = setup();
    await user.type(input, "  Jaki model zgłosiłem?  {Enter}");
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith("Jaki model zgłosiłem?");
    expect(input).toHaveValue("");
  });

  it("inserts a newline on Shift+Enter instead of sending", async () => {
    const { onSend, user, input } = setup();
    await user.type(input, "linia pierwsza{Shift>}{Enter}{/Shift}linia druga");
    expect(onSend).not.toHaveBeenCalled();
    expect(input).toHaveValue("linia pierwsza\nlinia druga");
  });

  it("sends with the send button", async () => {
    const { onSend, user, input } = setup();
    await user.type(input, "Wysyłam przyciskiem");
    await user.click(screen.getByRole("button", { name: COPY.chat.send }));
    expect(onSend).toHaveBeenCalledWith("Wysyłam przyciskiem");
  });

  it("is disabled while the assistant is busy and does not send", async () => {
    const { onSend, user } = setup(true);
    const input = screen.getByRole("textbox", { name: COPY.chat.inputLabel });
    expect(input).toBeDisabled();
    expect(screen.getByRole("button", { name: COPY.chat.send })).toBeDisabled();
    await user.click(input);
    await user.keyboard("tekst{Enter}");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("shows the counter and limits input to 2000 characters", async () => {
    const { user, input } = setup();
    expect(input).toHaveAttribute("maxlength", String(CHAT_MESSAGE_MAX));
    expect(screen.getByText(COPY.chat.counter(0, CHAT_MESSAGE_MAX))).toBeInTheDocument();
    await user.type(input, "abc");
    expect(screen.getByText(COPY.chat.counter(3, CHAT_MESSAGE_MAX))).toBeInTheDocument();
  });

  it("has no file input or attach button and ignores dropped files (AC-27)", () => {
    const { container } = render(<ChatInput disabled={false} onSend={() => undefined} />);
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    const file = new File(["x"], "zdjecie.jpg", { type: "image/jpeg" });
    const dropTarget = screen.getByRole("textbox", { name: COPY.chat.inputLabel });
    const dropped = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(dropped, "dataTransfer", { value: { files: [file], types: ["Files"] } });
    dropTarget.dispatchEvent(dropped);
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});
