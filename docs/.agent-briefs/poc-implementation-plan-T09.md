# Brief T09 — Client-side image downscaling

## Goal and observable outcome
A browser module that validates the selected photo and converts it into a JPEG whose longest edge is at most 1568 px and whose size is at most 1.5 MB, honoring EXIF orientation, before it is ever sent (AC-07, AC-10). Real browser behavior is proven later in E2E; here the browser canvas APIs are injected and mocked (they are not an endpoint).

## Editable files
- `app/src/lib/image/downscale.ts`
- `app/tests/unit/image/downscale.test.ts`

## Specification (ADR-004 §3.5)
1. Reject before decoding: type not in {image/jpeg, image/png, image/webp} → error `format` ("Dozwolone formaty: JPG, PNG, WebP" = `COPY.form.errors.photoFormat`); size > 10 MB (10 × 1024 × 1024 bytes) → error `size` (`COPY.form.errors.photoSize`).
2. Decode with `createImageBitmap(file, { imageOrientation: "from-image" })`.
3. Scale so the longest edge ≤ 1568 px (never upscale); draw onto a canvas (OffscreenCanvas where available, else an `HTMLCanvasElement`) after filling it white (PNG transparency → white).
4. Encode `image/jpeg` quality 0.82; if > 1.5 MB (1.5 × 1024 × 1024 bytes), retry 0.7 then 0.6; if still > 1.5 MB, scale the longest edge to 1280 px and retry once (quality 0.6). Verify the returned `blob.type` is `image/jpeg`.
5. Decoding failure (or still too large, or wrong blob type) → error `decode` (`COPY.form.errors.photoUnreadable`: "Nie udało się odczytać zdjęcia. Wybierz inny plik.") and the file is not accepted.
6. (Thumbnails/object URLs are handled by the form component in a later task, not here.)

Required API — make the browser APIs injectable so the logic is unit-testable:
```ts
export const ACCEPTED_TYPES: readonly string[]; // image/jpeg, image/png, image/webp
export const MAX_INPUT_BYTES = 10 * 1024 * 1024;
export const MAX_OUTPUT_BYTES = 1.5 * 1024 * 1024;
export const MAX_EDGE = 1568;
export const FALLBACK_EDGE = 1280;
export type DownscaleError = "format" | "size" | "decode";
export type DownscaleResult =
  | { ok: true; blob: Blob; width: number; height: number }
  | { ok: false; error: DownscaleError; message: string }; // message from COPY.form.errors
export type DecodedImage = { width: number; height: number; source: CanvasImageSource; close(): void };
export type ImageEnv = {
  decode(file: Blob): Promise<DecodedImage>; // default: createImageBitmap(file, { imageOrientation: "from-image" })
  encode(image: DecodedImage, width: number, height: number, quality: number): Promise<Blob>; // default: white-filled canvas, drawImage, JPEG blob
};
export function validatePhotoFile(file: { type: string; size: number }): DownscaleError | null;
export function targetSize(width: number, height: number, maxEdge: number): { width: number; height: number }; // rounds, never upscales
export async function downscaleImage(file: File, env?: ImageEnv): Promise<DownscaleResult>; // env defaults to the browser implementation
```
Always call `image.close()` when done (also on failure).

## Test inputs (folder rules — read `assets/example-images/README.md`)
Use only the real photos in `assets/example-images/` as image inputs; never generate images or empty image files. Read them in the test with `node:fs` from `join(process.cwd(), "..", "assets", "example-images", <name>)` and wrap the bytes in a `File` (`new File([bytes], name, { type })`). Known facts: `laptop-1.png` is JPEG content with a `.png` name, 3024×3135, 1.2 MB (the browser reports its type as the extension suggests, so use `image/png` as the File type to mirror reality); `phone-2.jpeg` is 387×516, 15 KB. The mocked `decode` returns those known dimensions (a mock canvas API, not an endpoint). Format/size rejection tests use metadata-only objects (`{ type: "image/gif", size: 1000 }`, `{ type: "image/jpeg", size: 10 * 1024 * 1024 + 1 }`) passed to `validatePhotoFile`, and for `downscaleImage` a `File` built from a real photo's bytes with a different `type` (e.g. `image/heic`); never decode or send them anywhere.

## TDD cases (write first; they fail because the module is missing)
- `laptop-1.png` (3024×3135) → encode called with width ≤ 1568 and height 1568 (longest edge 1568, aspect ratio kept ±1 px), quality 0.82; result ok, blob type `image/jpeg`.
- `phone-2.jpeg` (387×516) → encoded at 387×516 (not upscaled).
- quality chain: mock encode returns a 2 MB blob for quality ≥ 0.6 at 1568 px and 1 MB at 1280 px → calls in order 0.82, 0.7, 0.6 at 1568, then 0.6 at 1280; result ok with the 1280 size.
- still too large after the fallback → `decode` error with `COPY.form.errors.photoUnreadable`.
- encode returns a blob with type `image/png` → `decode` error.
- decode throws → `decode` error, and no encode call.
- `validatePhotoFile`: gif → `format`; heic → `format`; 10 MB + 1 byte jpeg → `size`; exactly 10 MB webp → null.
- `downscaleImage` with a heic-typed File → `format` error and decode never called.
- `close()` called once in success and failure paths.
Then: `npm run test`, `npm run typecheck`, `npm run lint`.

## Rules (all workers)
- Repository root: `/home/labuser/jsystems-ai-programming-2026-11/.claude/worktrees/skills-lock`; run npm commands inside `app/`. Stack: Next.js 16, TypeScript strict (`noUncheckedIndexedAccess`), Zod 4.6.7, Vitest 5 (`unit` project = jsdom, `tests/unit/**`; `integration` = node). Network is blocked in tests.
- Shared contracts are read-only for you: `app/src/lib/domain/{schemas,categories,copy-pl,errors}.ts`. Import from there; if you need a change, report it.
- Library facts: Context7 first (`resolve-library-id` → `query-docs`); CLI facts: `--help`. Never guess APIs.
- TDD: write the behavioral tests first, run them, record the failure reason, then implement the minimum, then run the full checks.
- No `any`, no type assertions (`as`, including `as const`) — ESLint enforces it. Use type guards (`typeof OffscreenCanvas !== "undefined"`, `instanceof`), `satisfies`. For the canvas 2D context, check for null instead of asserting.
- This module runs in the browser: do not import `server-only`, `node:*` or anything from `src/lib/ai`, `src/lib/security`, `src/lib/server`.
- Edit only the files listed in your brief. Never `npm install`, never touch `package.json`, the lockfile, configs, `globals.css`, `layout.tsx`, `page.tsx`, docs, `assets/`. `curl`, `wget`, `sudo` are denied.
- Report contradictions instead of guessing. Do not commit; the orchestrator reviews and commits.
- Concurrent workers (do not edit their files): T03 `app/src/app/layout.tsx`, `globals.css`, `app/src/fonts/*`, `app/public/*`, `app/tests/e2e/smoke.spec.ts`; T05 `app/src/lib/domain/policy-window.ts` + test; T06 `app/content/policies/*`, `app/src/lib/ai/policies.ts` + test; T08 `app/src/lib/security/case-token.ts` + test. Other workers' tests may be red while they work; judge only your own files, but report full-suite results.

## Report
Files changed; the red run and its failure reason; final outputs of `npm run test` (files/tests counts, skips), `npm run typecheck`, `npm run lint`; assumptions and contradictions.
