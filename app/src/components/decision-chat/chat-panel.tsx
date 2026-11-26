"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useMemo } from "react";

import { COPY } from "@/lib/domain/copy-pl";
import { DecisionSchema, type ChatUIMessage } from "@/lib/domain/schemas";

import { ChatInput } from "./chat-input";
import { ChatMessages } from "./chat-messages";

type ChatPanelProps = {
  caseId: string;
  caseToken: string;
  firstMessage: ChatUIMessage;
  fetchImpl?: typeof fetch;
};

// ADR-004 §3.3: useChat drives POST /api/chat. The case token comes from props, never from a hidden input.
// The panel fills its parent's height: messages scroll, the input stays at the bottom.
export function ChatPanel({ caseId, caseToken, firstMessage, fetchImpl }: ChatPanelProps) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport<ChatUIMessage>({
        api: "/api/chat",
        fetch: fetchImpl,
        prepareSendMessagesRequest: ({ id, messages, trigger }) => ({
          body: { id, messages, caseToken, trigger },
        }),
      }),
    [caseToken, fetchImpl],
  );

  const { messages, sendMessage, regenerate, status, error } = useChat<ChatUIMessage>({
    id: caseId,
    messages: [firstMessage],
    transport,
    dataPartSchemas: { decision: DecisionSchema },
  });

  function handleSend(text: string) {
    if (status !== "ready") return;
    void sendMessage({ text });
  }

  function handleRetry() {
    void regenerate();
  }

  return (
    <section aria-label={COPY.chat.title} className="flex h-full min-h-0 w-full flex-col">
      <ChatMessages messages={messages} status={status} error={error} onRetry={handleRetry} />
      <div className="shrink-0 p-4">
        <ChatInput disabled={status !== "ready"} onSend={handleSend} />
      </div>
    </section>
  );
}
