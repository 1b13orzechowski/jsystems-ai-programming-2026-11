"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "cn";
import { COPY } from "@/lib/domain/copy-pl";
import type { CaseInput } from "@/lib/domain/schemas";

type CaseSummaryProps = {
  input: CaseInput;
  photoUrl: string | null;
};

/** `YYYY-MM-DD` to `dd.MM.yyyy` without a Date round-trip (no timezone shifts). */
export function formatPurchaseDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}

// Read-only case data (AC-21). Mobile: collapsible above the chat. Desktop (>= 1024 px): side column, always open.
export function CaseSummary({ input, photoUrl }: CaseSummaryProps) {
  const [expanded, setExpanded] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const hasReason = input.reason.trim().length > 0;

  return (
    <section
      data-testid="case-summary"
      className="flex w-full flex-col gap-3 rounded-[20px] bg-background p-4 text-sm shadow-[0_10px_24px_rgba(33,33,33,0.10)] lg:w-80 lg:shrink-0"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{COPY.summary.title}</h2>
        <Button
          type="button"
          variant="ghost"
          aria-expanded={expanded}
          aria-controls="case-summary-details"
          onClick={() => setExpanded((value) => !value)}
          className="min-h-11 lg:hidden"
        >
          {COPY.summary.toggle}
        </Button>
      </div>

      <div id="case-summary-details" className={cn("flex flex-col gap-3", expanded ? "flex" : "hidden", "lg:flex")}>
        {photoUrl ? (
          <PhotoThumbnail photoUrl={photoUrl} />
        ) : null}

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
          <dt className="text-muted-foreground">{COPY.summary.caseType}</dt>
          <dd className="font-medium">{COPY.caseTypes[input.caseType]}</dd>
          <dt className="text-muted-foreground">{COPY.summary.category}</dt>
          <dd className="font-medium">{input.category}</dd>
          <dt className="text-muted-foreground">{COPY.summary.model}</dt>
          <dd className="font-medium break-words">{input.model}</dd>
          <dt className="text-muted-foreground">{COPY.summary.purchaseDate}</dt>
          <dd className="font-medium">{formatPurchaseDate(input.purchaseDate)}</dd>
        </dl>

        <div className="flex flex-col gap-1">
          <h3 className="text-muted-foreground">{COPY.summary.reason}</h3>
          {hasReason ? (
            <>
              <p
                className={cn("break-words whitespace-pre-line", reasonOpen ? "" : "line-clamp-3")}
              >
                {input.reason}
              </p>
              <Button
                type="button"
                variant="link"
                aria-expanded={reasonOpen}
                onClick={() => setReasonOpen((value) => !value)}
                className="h-auto min-h-11 justify-start px-0"
              >
                {reasonOpen ? COPY.summary.showLess : COPY.summary.showMore}
              </Button>
            </>
          ) : (
            <p>{COPY.summary.noReason}</p>
          )}
        </div>
      </div>
    </section>
  );
}

function PhotoThumbnail({ photoUrl }: { photoUrl: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={COPY.summary.photoOpen}
          className="block w-full overflow-hidden rounded-md border border-border focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL, not optimizable */}
          <img src={photoUrl} alt="" className="h-32 w-full object-cover" />
        </button>
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="sr-only">{COPY.summary.photoDialogTitle}</DialogTitle>
          <DialogDescription className="sr-only">{COPY.summary.photoAlt}</DialogDescription>
        </DialogHeader>
        {/* eslint-disable-next-line @next/next/no-img-element -- local object URL, not optimizable */}
        <img src={photoUrl} alt={COPY.summary.photoAlt} className="max-h-[70vh] w-full object-contain" />
        <DialogClose asChild>
          <Button type="button" variant="outline" className="min-h-11 self-end text-base">
            {COPY.summary.close}
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
