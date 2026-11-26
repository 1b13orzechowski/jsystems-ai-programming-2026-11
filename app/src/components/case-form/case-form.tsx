"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";

import { PhotoPicker } from "@/components/case-form/photo-picker";
import type { CaseFormValues, CaseSubmission, SelectedPhoto } from "@/components/case-form/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EQUIPMENT_CATEGORIES } from "@/lib/domain/categories";
import { COPY } from "@/lib/domain/copy-pl";
import { todayInTimeZone } from "@/lib/domain/policy-window";
import { MODEL_MAX, REASON_MAX, createCaseInputSchema } from "@/lib/domain/schemas";

const APP_TIMEZONE = "Europe/Warsaw";

type FieldName = "caseType" | "category" | "model" | "purchaseDate" | "reason" | "photo";
type FieldErrors = Partial<Record<FieldName, string>>;

const FIELD_NAMES: readonly FieldName[] = ["caseType", "category", "model", "purchaseDate", "reason", "photo"];

function isFieldName(key: PropertyKey | undefined): key is FieldName {
  return key === "caseType" || key === "category" || key === "model" || key === "purchaseDate" || key === "reason" || key === "photo";
}

/** Runs the shared Zod schema (AC-02…AC-06) and keeps the first message per field. */
function currentToday(): string {
  return todayInTimeZone(new Date(), APP_TIMEZONE);
}

function subscribeNever(): () => void {
  return () => undefined;
}

function computeErrors(values: CaseFormValues, photo: SelectedPhoto | null, today: string): FieldErrors {
  const errors: FieldErrors = {};
  const parsed = createCaseInputSchema({ today }).safeParse(values);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (isFieldName(key) && key !== "photo" && errors[key] === undefined) {
        errors[key] = issue.message;
      }
    }
  }
  if (photo === null) errors.photo = COPY.form.errors.required;
  return errors;
}

function hasAnyError(errors: FieldErrors): boolean {
  return FIELD_NAMES.some((name) => errors[name] !== undefined);
}

type CaseFormProps = {
  initialValues: CaseFormValues;
  initialPhoto: SelectedPhoto | null;
  disabled: boolean;
  onSubmit: (submission: CaseSubmission) => void;
};

export function CaseForm({ initialValues, initialPhoto, disabled, onSubmit }: CaseFormProps) {
  const baseId = useId();
  const idFor = (name: string) => `${baseId}-${name}`;
  const [values, setValues] = useState<CaseFormValues>(initialValues);
  const [photo, setPhoto] = useState<SelectedPhoto | null>(initialPhoto);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [focusRequest, setFocusRequest] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  // "Today" is read at event time, never during render: Cache Components prerenders client components and
  // rejects `new Date()` there. The date input's `max` comes from the browser only (undefined while prerendering).
  const maxDate = useSyncExternalStore(subscribeNever, currentToday, () => undefined);

  // After a rejected submit, focus moves to the first invalid control in DOM (PRD 9.1) order.
  useEffect(() => {
    if (focusRequest === 0) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [focusRequest]);

  // Errors already on screen are refreshed after every change; fixed fields lose their message.
  function refreshShown(all: FieldErrors) {
    setErrors((previous) => {
      const next: FieldErrors = {};
      for (const name of FIELD_NAMES) {
        const message = all[name];
        if (previous[name] !== undefined && message !== undefined) next[name] = message;
      }
      return next;
    });
  }

  function setField(key: keyof CaseFormValues, value: string) {
    const next: CaseFormValues = { ...values, [key]: value };
    setValues(next);
    refreshShown(computeErrors(next, photo, currentToday()));
  }

  function setPhotoValue(next: SelectedPhoto | null) {
    setPhoto(next);
    refreshShown(computeErrors(values, next, currentToday()));
  }

  function validateOnBlur(name: FieldName) {
    const all = computeErrors(values, photo, currentToday());
    setErrors((previous) => ({ ...previous, [name]: all[name] }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;

    const all = computeErrors(values, photo, currentToday());
    setErrors(all);
    const parsed = createCaseInputSchema({ today: currentToday() }).safeParse(values);
    if (hasAnyError(all) || !parsed.success || photo === null) {
      setFocusRequest((count) => count + 1);
      return;
    }
    onSubmit({ input: parsed.data, photo });
  }

  const errorId = (name: FieldName) => idFor(`${name}-error`);
  const describedByError = (name: FieldName) => (errors[name] !== undefined ? errorId(name) : undefined);
  const isInvalid = (name: FieldName) => (errors[name] !== undefined ? true : undefined);
  const requiredMarker = COPY.form.requiredMarker;
  const reasonRequired = values.caseType === "reklamacja";

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-6 border-0 p-0">
        <legend className="sr-only">{COPY.form.legend}</legend>

        <div className="flex flex-col gap-2" onBlur={() => validateOnBlur("caseType")}>
          <FieldHeading id={idFor("caseType-label")} text={COPY.form.labels.caseType} marker={requiredMarker} />
          <RadioGroup
            aria-labelledby={idFor("caseType-label")}
            aria-describedby={describedByError("caseType")}
            value={values.caseType}
            onValueChange={(value) => setField("caseType", value)}
            disabled={disabled}
            className="grid-cols-2 gap-3"
          >
            <RadioOption id={idFor("caseType-zwrot")} value="zwrot" text={COPY.caseTypes.zwrot} invalid={isInvalid("caseType")} />
            <RadioOption
              id={idFor("caseType-reklamacja")}
              value="reklamacja"
              text={COPY.caseTypes.reklamacja}
              invalid={isInvalid("caseType")}
            />
          </RadioGroup>
          <FieldError id={errorId("caseType")} message={errors.caseType} />
        </div>

        <div className="flex flex-col gap-2">
          <FieldHeading htmlFor={idFor("category")} text={COPY.form.labels.category} marker={requiredMarker} />
          <Select value={values.category} onValueChange={(value) => setField("category", value)} disabled={disabled}>
            <SelectTrigger
              id={idFor("category")}
              aria-invalid={isInvalid("category")}
              aria-describedby={describedByError("category")}
              onBlur={() => validateOnBlur("category")}
              className="h-11 w-full"
            >
              <SelectValue placeholder={COPY.form.categoryPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {EQUIPMENT_CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError id={errorId("category")} message={errors.category} />
        </div>

        <div className="flex flex-col gap-2">
          <FieldHeading htmlFor={idFor("model")} text={COPY.form.labels.model} marker={requiredMarker} />
          <Input
            id={idFor("model")}
            maxLength={MODEL_MAX}
            value={values.model}
            placeholder={COPY.form.modelPlaceholder}
            onChange={(event) => setField("model", event.target.value)}
            onBlur={() => validateOnBlur("model")}
            aria-invalid={isInvalid("model")}
            aria-describedby={describedByError("model")}
            disabled={disabled}
            className="h-11"
          />
          <FieldError id={errorId("model")} message={errors.model} />
        </div>

        <div className="flex flex-col gap-2">
          <FieldHeading htmlFor={idFor("purchaseDate")} text={COPY.form.labels.purchaseDate} marker={requiredMarker} />
          <Input
            id={idFor("purchaseDate")}
            type="date"
            max={maxDate}
            value={values.purchaseDate}
            onChange={(event) => setField("purchaseDate", event.target.value)}
            onBlur={() => validateOnBlur("purchaseDate")}
            aria-invalid={isInvalid("purchaseDate")}
            aria-describedby={describedByError("purchaseDate")}
            disabled={disabled}
            className="h-11 w-full sm:w-60"
          />
          <FieldError id={errorId("purchaseDate")} message={errors.purchaseDate} />
        </div>

        <div className="flex flex-col gap-2">
          <FieldHeading
            htmlFor={idFor("reason")}
            text={COPY.form.labels.reason}
            marker={reasonRequired ? requiredMarker : COPY.form.optionalMarker}
          />
          <p id={idFor("reason-hint")} className="text-sm text-muted-foreground">
            {reasonRequired ? COPY.form.reasonHintComplaint : COPY.form.reasonHintReturn}
          </p>
          <Textarea
            id={idFor("reason")}
            maxLength={REASON_MAX}
            rows={4}
            value={values.reason}
            onChange={(event) => setField("reason", event.target.value)}
            onBlur={() => validateOnBlur("reason")}
            aria-invalid={isInvalid("reason")}
            aria-describedby={[idFor("reason-hint"), idFor("reason-counter"), describedByError("reason")]
              .filter((id): id is string => id !== undefined)
              .join(" ")}
            disabled={disabled}
          />
          <p id={idFor("reason-counter")} className="text-right text-sm text-muted-foreground">
            {COPY.form.reasonCounter(values.reason.length, REASON_MAX)}
          </p>
          <FieldError id={errorId("reason")} message={errors.reason} />
        </div>

        <PhotoPicker
          value={photo}
          onChange={setPhotoValue}
          disabled={disabled}
          caseType={values.caseType}
          error={errors.photo}
          describedById={errorId("photo")}
        />

        <Button
          type="submit"
          disabled={disabled}
          className="min-h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto sm:self-end"
        >
          {COPY.form.submit}
        </Button>
      </fieldset>
    </form>
  );
}

function FieldHeading({
  id,
  htmlFor,
  text,
  marker,
}: {
  id?: string;
  htmlFor?: string;
  text: string;
  marker: string;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <Label id={id} htmlFor={htmlFor}>
        {text}
      </Label>
      <span className="text-sm text-muted-foreground">{marker}</span>
    </div>
  );
}

function RadioOption({
  id,
  value,
  text,
  invalid,
}: {
  id: string;
  value: string;
  text: string;
  invalid: true | undefined;
}) {
  return (
    <div className="flex min-h-11 items-center gap-2">
      <RadioGroupItem id={id} value={value} aria-invalid={invalid} />
      <Label htmlFor={id}>{text}</Label>
    </div>
  );
}

function FieldError({ id, message }: { id: string; message: string | undefined }): ReactNode {
  if (message === undefined) return null;
  return (
    <p id={id} className="text-sm text-status-rejected-text">
      {message}
    </p>
  );
}
