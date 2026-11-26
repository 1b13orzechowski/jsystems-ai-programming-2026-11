"use client";

import { useId, useRef, useState, type DragEvent } from "react";

import type { SelectedPhoto } from "@/components/case-form/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { COPY } from "@/lib/domain/copy-pl";
import { type DownscaleError, downscaleImage, validatePhotoFile } from "@/lib/image/downscale";

const PHOTO_MESSAGES: Record<DownscaleError, string> = {
  format: COPY.form.errors.photoFormat,
  size: COPY.form.errors.photoSize,
  decode: COPY.form.errors.photoUnreadable,
};

type PhotoPickerProps = {
  value: SelectedPhoto | null;
  onChange: (photo: SelectedPhoto | null) => void;
  disabled: boolean;
  caseType: string;
  error: string | undefined;
  describedById: string;
};

export function PhotoPicker({ value, onChange, disabled, caseType, error, describedById }: PhotoPickerProps) {
  const labelId = useId();
  const hintId = `${describedById}-hint`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  const hint = caseType === "reklamacja" ? COPY.form.photoHintComplaint : COPY.form.photoHintReturn;
  const message = fileError ?? error ?? null;

  // A rejected file is never kept: a previously selected photo is cleared and its preview revoked.
  function reject(text: string) {
    setFileError(text);
    if (value) {
      URL.revokeObjectURL(value.previewUrl);
      onChange(null);
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file || disabled) return;
    setFileError(null);

    const invalid = validatePhotoFile(file);
    if (invalid) {
      reject(PHOTO_MESSAGES[invalid]);
      return;
    }

    setPreparing(true);
    const result = await downscaleImage(file);
    setPreparing(false);
    if (!result.ok) {
      reject(result.message);
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    if (value) URL.revokeObjectURL(value.previewUrl);
    onChange({ originalFile: file, previewUrl, jpegBlob: result.blob, name: file.name });
  }

  function handleRemove() {
    if (value) URL.revokeObjectURL(value.previewUrl);
    setFileError(null);
    onChange(null);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    void handleFile(event.dataTransfer.files[0]);
  }

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <Label id={labelId}>{COPY.form.labels.photo}</Label>
        <span className="text-sm text-muted-foreground">{COPY.form.requiredMarker}</span>
      </div>

      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        className="flex flex-col gap-3 rounded-[20px] border border-dashed border-border bg-card p-4"
      >
        {value ? (
          <div className="flex items-center gap-3">
            {/* Blob preview of the user's own file; next/image cannot serve object URLs. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value.previewUrl} alt={COPY.form.photoThumbnailAlt} className="size-20 rounded-md object-cover" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="truncate text-sm">{value.name}</p>
              <Button
                type="button"
                variant="ghost"
                onClick={handleRemove}
                disabled={disabled}
                className="min-h-11 self-start px-3"
              >
                {COPY.form.photoRemove}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{COPY.form.photoDropZone}</p>
        )}

        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
        <p className="text-sm text-muted-foreground">{COPY.form.photoFormats}</p>

        <div>
          <Button
            type="button"
            variant="outline"
            disabled={disabled || preparing}
            aria-invalid={message !== null ? true : undefined}
            aria-describedby={message !== null ? describedById : hintId}
            onClick={() => inputRef.current?.click()}
            className="min-h-11"
          >
            {COPY.form.photoChoose}
          </Button>
          <input
            ref={inputRef}
            type="file"
            data-testid="photo-input"
            accept="image/jpeg,image/png,image/webp"
            aria-label={COPY.form.labels.photo}
            className="sr-only"
            tabIndex={-1}
            disabled={disabled}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void handleFile(file);
            }}
          />
        </div>
      </div>

      {preparing ? (
        <p role="status" className="text-sm text-muted-foreground">
          {COPY.form.photoPreparing}
        </p>
      ) : null}
      {message !== null ? (
        <p id={describedById} className="text-sm text-status-rejected-text">
          {message}
        </p>
      ) : null}
    </div>
  );
}
