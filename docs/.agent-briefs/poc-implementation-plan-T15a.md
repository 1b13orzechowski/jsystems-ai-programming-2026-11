# Brief T15a — Case form screen components (no network; part of T15)

T15 is split while the OpenRouter key is being fixed: this part builds the presentational form screen driven by props and callbacks. `submitCase` (stream reader, needs real `/api/case` captures) follows in T15b. `page.tsx` wiring is T17.

## Goal and observable outcome
A Polish, accessible case form (PRD 9.1, AC-01…AC-09, AC-12, AC-13 UI, AC-35) that validates on blur and on submit with the shared Zod schema, handles one photo with client-side downscaling, shows the processing panel and the error banner, and calls `onSubmit` with validated data.

## Editable files
- `app/src/components/case-form/case-form-screen.tsx`
- `app/src/components/case-form/case-form.tsx`
- `app/src/components/case-form/photo-picker.tsx`
- `app/src/components/case-form/processing-panel.tsx`
- `app/src/components/case-form/error-banner.tsx`
- `app/src/components/case-form/types.ts`
- `app/tests/unit/case-form/*.test.tsx`

## Read first
- `docs/PRD.md` §4.1–4.3, §4.6, §6 AC-01…AC-13, AC-33, AC-35, §9.1.
- `docs/ADR/004-frontend.md` §3.1 (components `CaseFormScreen`, `CaseForm`, `PhotoPicker`, `ProcessingPanel`, `ErrorBanner`), §3.4 (tokens), §3.5 (downscaling), §4 (AppState).
- **UI contract**: section "UI contract the specs rely on" in `docs/.agent-briefs/poc-implementation-plan-T18-specs.md` (the committed E2E specs in `app/tests/e2e/form-validation.spec.ts`, `helpers/case-form.ts` depend on it — read them too). Additional contract points: invalid fields carry `aria-invalid="true"` and `aria-describedby` pointing to their error text; on submit focus moves to the first invalid field; required error on exactly five fields when empty (caseType, category, model, purchaseDate, photo); radios found by role `radio` with exact names "Zwrot"/"Reklamacja" inside a `radiogroup` labelled `COPY.form.labels.caseType`; category is a shadcn `Select` whose trigger has role `combobox` and accessible name `COPY.form.labels.category`, options with exact category names; model/date/reason found by `getByLabel` with the COPY label text; photo `<input type="file" data-testid="photo-input" accept="image/jpeg,image/png,image/webp">` visually hidden (`sr-only`), opened by a button `COPY.form.photoChoose`; thumbnail `<img alt={COPY.form.photoThumbnailAlt}>`, the file name as text, button `COPY.form.photoRemove`.
- Existing modules: `@/lib/domain/schemas` (`createCaseInputSchema`, `CaseInput`, limits), `@/lib/domain/categories`, `@/lib/domain/copy-pl` (`COPY` — **every** visible/ARIA string comes from here; a guard test fails on literals), `@/lib/domain/policy-window` (`todayInTimeZone(new Date(), "Europe/Warsaw")` for `max` of the date input and for the schema), `@/lib/image/downscale` (`downscaleImage`, `validatePhotoFile`), shadcn components in `@/components/ui/*` (button, input, textarea, label, select, radio-group, alert, card, spinner).

## Component API (types in `types.ts`)
```ts
export type SelectedPhoto = { originalFile: File; previewUrl: string; jpegBlob: Blob; name: string };
export type CaseFormValues = { caseType: string; category: string; model: string; purchaseDate: string; reason: string };
export const EMPTY_CASE_FORM_VALUES: CaseFormValues;
export type CaseSubmission = { input: CaseInput; photo: SelectedPhoto };
```
- `CaseFormScreen({ initialValues, initialPhoto, processing, stage, submitError, onSubmit, onRetry })`: intro is already in the layout; renders `ErrorBanner` (when `submitError` is not null) above `CaseForm`, and `ProcessingPanel` (when `processing`). `stage: "analyzing" | "deciding" | null`.
- `CaseForm({ initialValues, initialPhoto, disabled, onSubmit })`: owns field state initialised from props (so after an error the page re-renders it with the preserved values and photo). Validation with `createCaseInputSchema({ today })` on blur (that field) and on submit (all fields + photo required). On valid submit calls `onSubmit({ input, photo })` once; while `disabled` (processing) every field and the submit button are disabled and submit does nothing (AC-09). Reason: `maxLength={2000}`, counter `COPY.form.reasonCounter(len, 2000)`; required marker and hint depend on case type (`COPY.form.reasonHintComplaint` / `reasonHintReturn`, `requiredMarker` / `optionalMarker`). Model `maxLength={100}`. Date `<input type="date" max={today}>`. Fields in PRD order: case type, category, model, purchase date, reason, photo. Submit button `COPY.form.submit`, min height 44 px, magenta primary.
- `PhotoPicker({ value, onChange, disabled, caseType, error, describedById })`: drop zone + choose button; hint `COPY.form.photoHintReturn`/`photoHintComplaint` by case type; on file: `validatePhotoFile` → AC-07 messages; else `downscaleImage(file)` (show `COPY.form.photoPreparing` while running) → on ok create `URL.createObjectURL(file)` for the preview (original file), call `onChange(photo)`; on error show the message and keep no file. Remove/replace revokes the previous object URL (`URL.revokeObjectURL`). Drag-and-drop accepts one file.
- `ProcessingPanel({ stage })`: `aria-live="polite"` region, text `COPY.processing.analyzing` / `deciding`, shimmer/spinner visual (`@/components/ui/spinner` or the `shimmer` class), info colors (bg `status-info-bg`, border `status-info-border`).
- `ErrorBanner({ onRetry })`: `role="alert"`, `COPY.errorBanner.message`, button `COPY.errorBanner.retry`; error colors (`status-rejected-*`), never magenta.
Mark every file that uses state/effects/events with `"use client"`.

## TDD (React Testing Library + user-event, write first; red because files are missing)
From ADR-004 §8: field order and labels (AC-01, AC-35); submit empty → `COPY.form.errors.required` on the 5 fields, focus on the first, `onSubmit` not called (AC-02); reklamacja + "krótko" → complaint reason error (AC-03); zwrot without reason valid (AC-04); typing 2001 chars stops at 2000 and counter shows `2000/2000` (AC-05); tomorrow → future-date error (AC-06); photo: GIF and an 11 MB JPEG (metadata-only `File` objects built from a small byte array with the right `type`, plus `Object.defineProperty(file, "size", { value })` — no real image content needed because `downscaleImage` is mocked) → AC-07 messages and no thumbnail; valid photo (mock `@/lib/image/downscale` `downscaleImage` with `vi.mock` to resolve `{ ok: true, blob, width, height }`; mock `URL.createObjectURL`/`revokeObjectURL`) → thumbnail + name + remove; remove revokes the URL (AC-08); full valid submit → `onSubmit` called once with parsed input and photo; `disabled` → all inputs disabled and a second click does nothing (AC-09); `ProcessingPanel` stage texts (AC-12) and `aria-live`; `ErrorBanner` text, `role=alert`, retry calls `onRetry`; `CaseForm` re-rendered with `initialValues`/`initialPhoto` shows them (AC-13 restore). Radix Select in jsdom: open with user-event on the combobox and pick the option by role; if jsdom lacks `hasPointerCapture`/`scrollIntoView`, stub them on `Element.prototype` in the test file.
Then `npm run test`, `npm run typecheck`, `npm run lint`.

## Rules
- Repository root: `/home/labuser/jsystems-ai-programming-2026-11/.claude/worktrees/skills-lock`; npm commands in `app/`. React 19, Next 16 App Router, Tailwind 4 tokens in `src/app/globals.css` (status colors as `bg-status-approved-bg` etc. — read the file for exact names), shadcn Radix components.
- Library facts: Context7 (`/radix-ui/primitives`, `/shadcn-ui/ui`, `/testing-library/react-testing-library`) — never guess APIs.
- No `any`, no type assertions (`as`, `as const`); no string literals with letters in JSX text or `aria-label`/`alt`/`placeholder`/`title` (guard test) — use `COPY`. No browser storage APIs. Do not import `@/lib/ai`, `@/lib/security`, `@/lib/server`, `@/lib/env` (server-only).
- Edit only the listed files. Never `npm install`, never touch `package.json`, lockfile, configs, `globals.css`, `layout.tsx`, `page.tsx`, `src/components/ui/*`, shared contracts, docs. If a shadcn component is missing, report it. `curl`, `wget`, `sudo` denied. Do not start `next start` servers.
- Concurrent work (do not edit): T16a `app/src/components/decision-chat/*`, `app/tests/unit/decision-chat/*`; orchestrator `app/scripts/*`, `app/tests/fixtures/*`, `app/src/lib/ai/*`.
- Report contradictions instead of guessing. Do not commit.

## Report
Files; red run reason; final `npm run test` (counts, skips), `typecheck`, `lint`; assumptions/contradictions; any contract point you could not meet.
