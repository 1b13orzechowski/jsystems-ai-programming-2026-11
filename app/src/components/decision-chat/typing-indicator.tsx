import { cn } from "cn";
import { COPY } from "@/lib/domain/copy-pl";

// AC-23: shimmer text while the assistant is working. Motion is disabled for reduced-motion users.
export function TypingIndicator() {
  return (
    <p
      aria-live="polite"
      data-slot="typing-indicator"
      className={cn(
        "animate-pulse text-sm font-medium text-muted-foreground motion-reduce:animate-none",
      )}
    >
      {COPY.chat.typing}
    </p>
  );
}
