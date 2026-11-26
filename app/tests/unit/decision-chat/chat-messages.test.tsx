import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChatMessages } from "@/components/decision-chat/chat-messages";
import { COPY } from "@/lib/domain/copy-pl";
import { DECISION_DISCLAIMER_PL, type ChatUIMessage, type Decision, type UpdatedDecisionInput } from "@/lib/domain/schemas";

const decision: Decision = {
  label: "wymaga_weryfikacji",
  justificationPl: "Syntetyczne uzasadnienie początkowe.",
  citedRuleIds: ["Z-2"],
  nextStepsPl: ["Poczekaj na kontakt serwisu"],
  kind: "initial",
  disclaimerPl: DECISION_DISCLAIMER_PL,
};

const updatedInput: UpdatedDecisionInput = {
  label: "zaakceptowano",
  justificationPl: "Syntetyczne uzasadnienie po aktualizacji.",
  citedRuleIds: ["R-1"],
  nextStepsPl: ["Wyślij sprzęt"],
  changeReasonPl: "Klient dodał informacje o okolicznościach.",
};

const updatedDecision: Decision = {
  ...updatedInput,
  kind: "updated",
  disclaimerPl: DECISION_DISCLAIMER_PL,
};

const userMessage: ChatUIMessage = {
  id: "u1",
  role: "user",
  parts: [{ type: "text", text: "Czy mogę to zwrócić?" }],
};

const firstMessage: ChatUIMessage = {
  id: "a1",
  role: "assistant",
  parts: [
    { type: "text", text: "Oto **wstępna** decyzja." },
    { type: "data-decision", id: "d1", data: decision },
  ],
};

const updatedMessage: ChatUIMessage = {
  id: "a2",
  role: "assistant",
  parts: [
    {
      type: "tool-issueUpdatedDecision",
      toolCallId: "call-1",
      state: "output-available",
      input: updatedInput,
      output: updatedDecision,
    },
    { type: "text", text: "Zaktualizowałem decyzję." },
  ],
};

describe("ChatMessages", () => {
  it("renders the list contract with assistant and user messages", () => {
    render(
      <ChatMessages messages={[firstMessage, userMessage]} status="ready" error={undefined} onRetry={() => undefined} />,
    );
    const list = screen.getByRole("list", { name: COPY.chat.messagesLabel });
    const items = within(list).getAllByTestId("chat-message");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveAttribute("data-testid", "chat-message");
    expect(items[0]).toHaveAttribute("data-role", "assistant");
    expect(items[1]).toHaveAttribute("data-role", "user");
    expect(within(items[1] ?? list).getByText("Czy mogę to zwrócić?")).toBeInTheDocument();
  });

  it("renders a data-decision part as an initial decision card", () => {
    render(<ChatMessages messages={[firstMessage]} status="ready" error={undefined} onRetry={() => undefined} />);
    const card = screen.getByTestId("decision-card");
    expect(card).toHaveAttribute("data-decision-kind", "initial");
    expect(card).toHaveAttribute("data-decision-label", "wymaga_weryfikacji");
    expect(screen.getByRole("heading", { name: COPY.decision.title })).toBeInTheDocument();
    expect(screen.getByText(DECISION_DISCLAIMER_PL)).toBeInTheDocument();
    expect(screen.getByText("wstępna", { selector: "strong" })).toBeInTheDocument();
  });

  it("renders an output-available issueUpdatedDecision tool part as an updated card", () => {
    render(<ChatMessages messages={[updatedMessage]} status="ready" error={undefined} onRetry={() => undefined} />);
    const card = screen.getByTestId("decision-card");
    expect(card).toHaveAttribute("data-decision-kind", "updated");
    expect(screen.getByRole("heading", { name: COPY.decision.updatedTitle })).toBeInTheDocument();
    expect(screen.getByText("Klient dodał informacje o okolicznościach.")).toBeInTheDocument();
    expect(screen.getByText("Zaktualizowałem decyzję.")).toBeInTheDocument();
  });

  it("ignores tool parts in other states", () => {
    const pending: ChatUIMessage = {
      id: "a3",
      role: "assistant",
      parts: [
        {
          type: "tool-issueUpdatedDecision",
          toolCallId: "call-2",
          state: "input-streaming",
          input: undefined,
        },
      ],
    };
    const { container } = render(
      <ChatMessages messages={[pending]} status="streaming" error={undefined} onRetry={() => undefined} />,
    );
    expect(screen.queryByTestId("decision-card")).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-testid="chat-message"]')).toHaveLength(0);
  });

  it("shows the typing indicator while submitted", () => {
    render(<ChatMessages messages={[userMessage]} status="submitted" error={undefined} onRetry={() => undefined} />);
    const typing = screen.getByText(COPY.chat.typing, { exact: true });
    expect(typing).toHaveAttribute("aria-live", "polite");
  });

  it("shows the typing indicator while streaming before any assistant text", () => {
    render(<ChatMessages messages={[userMessage]} status="streaming" error={undefined} onRetry={() => undefined} />);
    expect(screen.getByText(COPY.chat.typing, { exact: true })).toBeInTheDocument();
  });

  it("hides the typing indicator when the assistant has text", () => {
    render(
      <ChatMessages messages={[userMessage, firstMessage]} status="streaming" error={undefined} onRetry={() => undefined} />,
    );
    expect(screen.queryByText(COPY.chat.typing, { exact: true })).not.toBeInTheDocument();
  });

  it("shows the chat error with retry under the last user message and keeps the message", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn<() => void>();
    render(
      <ChatMessages
        messages={[firstMessage, userMessage]}
        status="error"
        error={new Error("synthetic")}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText("Czy mogę to zwrócić?")).toBeInTheDocument();
    const alert = screen.getByRole("alert");
    expect(within(alert).getByText(COPY.chat.error)).toBeInTheDocument();
    await user.click(within(alert).getByRole("button", { name: COPY.chat.retry }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(COPY.chat.typing, { exact: true })).not.toBeInTheDocument();
  });

  it("shows no error when error is not set", () => {
    render(<ChatMessages messages={[userMessage]} status="ready" error={undefined} onRetry={() => undefined} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
