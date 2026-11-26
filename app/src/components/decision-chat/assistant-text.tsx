import type { ComponentProps } from "react";
import { Streamdown } from "streamdown";

import { cn } from "cn";

// Streamdown renders bold as <span data-streamdown="strong">; ADR-004 §8 requires a real <strong>.
function Strong({ className, children }: ComponentProps<"strong">) {
  return <strong className={cn("font-semibold", className)}>{children}</strong>;
}

const markdownComponents = { strong: Strong };

// Markdown from the model (AC-29). Styling lives on the wrapper so no Streamdown classes need a globals.css @source.
export function AssistantText({ text }: { text: string }) {
  return (
    <div
      data-slot="assistant-text"
      className={cn(
        "min-w-0 text-sm leading-relaxed wrap-break-word",
        "[&_h1]:mt-2 [&_h1]:text-lg [&_h1]:font-semibold",
        "[&_h2]:mt-2 [&_h2]:text-base [&_h2]:font-semibold",
        "[&_h3]:mt-2 [&_h3]:font-semibold",
        "[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
        "[&_strong]:font-semibold",
        "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
        "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
        "[&_li]:my-0.5",
      )}
    >
      <Streamdown mode="static" controls={false} components={markdownComponents}>
        {text}
      </Streamdown>
    </div>
  );
}
