"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { COPY } from "@/lib/domain/copy-pl";

type NewCaseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

// AC-32. The vendor close "X" (English sr-only text) is hidden; "Anuluj" closes the dialog instead.
export function NewCaseDialog({ open, onOpenChange, onConfirm }: NewCaseDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{COPY.newCaseDialog.title}</DialogTitle>
          <DialogDescription>{COPY.newCaseDialog.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" className="min-h-11 text-base">
              {COPY.newCaseDialog.cancel}
            </Button>
          </DialogClose>
          <Button type="button" onClick={onConfirm} className="min-h-11 text-base">
            {COPY.newCaseDialog.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
