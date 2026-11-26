import { Button } from "@/components/ui/button";
import { COPY } from "@/lib/domain/copy-pl";

// AC-28: shown under the last user message; the message itself stays in the list.
export function ChatError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      data-slot="chat-error"
      className="flex w-full flex-wrap items-center justify-between gap-3 rounded-lg border border-status-rejected-border bg-status-rejected-bg px-3 py-2 text-sm text-status-rejected-text"
    >
      <p>{COPY.chat.error}</p>
      <Button type="button" variant="outline" onClick={onRetry} className="min-h-11 bg-background px-4 text-base">
        {COPY.chat.retry}
      </Button>
    </div>
  );
}
