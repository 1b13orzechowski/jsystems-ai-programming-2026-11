"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "cn";
import { COPY } from "@/lib/domain/copy-pl";
import type { ChatUIMessage } from "@/lib/domain/schemas";

import { AssistantText } from "./assistant-text";
import { ChatError } from "./chat-error";
import { DecisionCard } from "./decision-card";
import { TypingIndicator } from "./typing-indicator";

type ChatMessagePart = ChatUIMessage["parts"][number];

type ChatMessagesProps = {
  messages: ChatUIMessage[];
  status: "ready" | "submitted" | "streaming" | "error";
  error?: Error | undefined;
  onRetry: () => void;
};

// ADR-004 §3.3: text -> markdown (assistant) or plain text (user); data-decision and
// tool-issueUpdatedDecision (output-available) -> DecisionCard; other tool states render nothing.
function renderPart(role: ChatUIMessage["role"], part: ChatMessagePart, index: number): ReactNode {
  if (part.type === "text") {
    if (role === "user") {
      return (
        <p key={index} className="rounded-xl bg-muted px-4 py-3 text-sm leading-relaxed break-words whitespace-pre-wrap">
          {part.text}
        </p>
      );
    }
    return (
      <div key={index} className="rounded-xl bg-muted px-4 py-3">
        <AssistantText text={part.text} />
      </div>
    );
  }
  if (part.type === "data-decision") {
    return <DecisionCard key={index} decision={part.data} />;
  }
  if (part.type === "tool-issueUpdatedDecision" && part.state === "output-available") {
    return <DecisionCard key={index} decision={part.output} />;
  }
  return null;
}

export function ChatMessages({ messages, status, error, onRetry }: ChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages, status]);

  const lastMessage = messages.at(-1);
  const assistantHasText =
    lastMessage?.role === "assistant" && lastMessage.parts.some((part) => part.type === "text" && part.text.length > 0);
  const showTyping = status === "submitted" || (status === "streaming" && !assistantHasText);
  const lastUserIndex = messages.findLastIndex((message) => message.role === "user");
  const showError = Boolean(error);

  const items = messages.map((message, messageIndex) => {
    const nodes = message.parts
      .map((part, partIndex) => renderPart(message.role, part, partIndex))
      .filter((node) => node !== null && node !== undefined);
    const withError = showError && messageIndex === lastUserIndex;
    if (nodes.length === 0 && !withError) return null;
    return (
      <li
        key={message.id}
        role="listitem"
        data-testid="chat-message"
        data-role={message.role}
        className={cn("flex w-full min-w-0", message.role === "user" ? "justify-end" : "justify-start")}
      >
        <div className={cn("flex max-w-[85%] min-w-0 flex-col gap-3", message.role === "user" && "items-end")}>
          {nodes}
          {withError ? <ChatError onRetry={onRetry} /> : null}
        </div>
      </li>
    );
  });

  return (
    <div ref={scrollRef} className="flex min-h-0 w-full flex-1 flex-col gap-6 overflow-y-auto p-4">
      <ul role="list" aria-label={COPY.chat.messagesLabel} className="m-0 flex list-none flex-col gap-6 p-0">
        {items}
      </ul>
      {showError && lastUserIndex < 0 ? <ChatError onRetry={onRetry} /> : null}
      {showTyping ? (
        <div className="px-1">
          <TypingIndicator />
        </div>
      ) : null}
    </div>
  );
}
