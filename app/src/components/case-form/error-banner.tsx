"use client";

import { Button } from "@/components/ui/button";
import { COPY } from "@/lib/domain/copy-pl";

export function ErrorBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-[20px] border border-status-rejected-border bg-status-rejected-bg p-4 text-status-rejected-text sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-base">{COPY.errorBanner.message}</p>
      <Button
        type="button"
        variant="outline"
        onClick={onRetry}
        className="min-h-11 border-status-rejected-border bg-background text-status-rejected-text hover:bg-status-rejected-bg"
      >
        {COPY.errorBanner.retry}
      </Button>
    </div>
  );
}
