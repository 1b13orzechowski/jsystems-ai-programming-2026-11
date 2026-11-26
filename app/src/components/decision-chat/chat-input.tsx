"use client";

import { useId, useState, type DragEvent, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupTextarea } from "@/components/ui/input-group";
import { COPY } from "@/lib/domain/copy-pl";
import { CHAT_MESSAGE_MAX } from "@/lib/domain/schemas";

type ChatInputProps = {
  disabled: boolean;
  onSend: (text: string) => void;
};

// AC-22/23/27: text only. No file input, no attach button; dropped files are ignored.
export function ChatInput({ disabled, onSend }: ChatInputProps) {
  const [value, setValue] = useState("");
  const inputId = useId();
  const counterId = useId();

  function send() {
    const text = value.trim();
    if (disabled || text.length === 0) return;
    onSend(text);
    setValue("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  }

  function ignoreDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
  }

  return (
    <div className="flex w-full flex-col gap-2" onDragOver={ignoreDrop} onDrop={ignoreDrop}>
      <label htmlFor={inputId} className="sr-only">
        {COPY.chat.inputLabel}
      </label>
      <InputGroup className="h-auto items-end rounded-[5px] border-border bg-background">
        <InputGroupTextarea
          id={inputId}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          maxLength={CHAT_MESSAGE_MAX}
          placeholder={COPY.chat.inputPlaceholder}
          rows={2}
          aria-describedby={counterId}
          className="max-h-40 min-h-11 text-base md:text-base"
        />
        <div className="flex items-center gap-2 p-2">
          <span id={counterId} className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
            {COPY.chat.counter(value.length, CHAT_MESSAGE_MAX)}
          </span>
          <Button type="button" onClick={send} disabled={disabled} className="min-h-11 min-w-11 px-4 text-base">
            {COPY.chat.send}
          </Button>
        </div>
      </InputGroup>
    </div>
  );
}
