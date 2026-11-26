# Brief T03 — Brand shell: language, font, tokens, logo, favicon

Repository root: `/home/labuser/jsystems-ai-programming-2026-11/.claude/worktrees/skills-lock`. App: `app/` (Next.js 16.4.6 App Router with `src/`, Tailwind 4, shadcn/ui Radix style `radix-nova`). Run npm commands inside `app/`.

## Goal and observable outcome
Opening `/` in the production build shows a branded shell: `<html lang="pl">`, Titillium Web as the page font (loaded locally with `next/font/local`), the brand logo with alt "Logo" in a header with the product name, the intro sentence "Sprawdź, czy Twój zwrot lub reklamacja może zostać przyjęta", brand colors mapped into Tailwind/shadcn variables, the brand favicon, no console errors and no horizontal scrolling at 360 px width.

## Editable files (only these)
- `app/src/app/layout.tsx`
- `app/src/app/globals.css`
- `app/src/fonts/*` (copies of font files)
- `app/public/logo.webp` (copy of `assets/logo.webp`)
- `app/src/app/favicon.ico` (replace with `assets/favicon.ico`)
- `app/tests/e2e/smoke.spec.ts`
- `docs/qa/screenshots/T03-01-shell-desktop.png`, `docs/qa/screenshots/T03-02-shell-360.png`

Do not edit `app/src/app/page.tsx` (it stays an empty `<main id="main-content" />` until a later task), `src/components/ui/*`, `src/lib/*`, `package.json`, the lockfile, configs. Do not run `npm install`. Report needed changes instead.

Concurrent work: another worker creates `app/src/lib/env.ts` and `app/tests/unit/env.test.ts`, `app/tests/unit/guards/*`. Those guard tests scan `src/app/**` and fail if a JSX text literal or an `alt`/`aria-label`/`placeholder`/`title` string literal contains letters, so **every visible string must come from `@/lib/domain/copy-pl`** (`COPY.app.productName`, `COPY.app.logoAlt`, `COPY.app.intro`, `COPY.app.metaDescription`, `COPY.app.skipToContent`). Metadata `title`/`description` in the `metadata` export also use `COPY`.

## Specification excerpts

ADR-004 §3.1: `app/layout.tsx` — Server component, `<html lang="pl">`, Titillium font variable, metadata (title "Hardware Service Decision Copilot" = `COPY.app.productName`), favicon. Header: logo (`/logo.webp`, alt "Logo"), product name. Intro text "Sprawdź, czy Twój zwrot lub reklamacja może zostać przyjęta" (PRD 9.1). The shell (header + intro + `{children}`) lives in `layout.tsx`. Include a visually hidden "skip to content" link targeting `#main-content`.

ADR-001 Step 6 fonts: copy into `app/src/fonts/` (Turbopack does not resolve files outside `app/`, never reference `../assets`). Use woff2 where available — regular 400 (`titilliumweb-regular-webfont.woff2`), bold 700 (`...-bold-...woff2`), black 900 (`...-black-...woff2`), light italic 300 italic (`...-lightitalic-...woff2`), extra-light 200 (`...-extralight-...woff2`), bold italic 700 italic (`...-bolditalic-...woff2`); woff for light 300 (`...-light-webfont.woff`), semibold 600 (`...-semibold-webfont.woff`), italic 400 (`...-italic-webfont.woff`), extra-light italic 200 italic (`...-extralightitalic-webfont.woff`). Skip `.eot` and `.ttf`. Source: `assets/fonts/titillium-web/`. Load with `next/font/local` (`src` array with `path`, `weight`, `style`), `variable: "--font-titillium"`, `display: "swap"`, fallback `Arial, sans-serif`. Map it in Tailwind `@theme inline`: `--font-sans: var(--font-titillium), Arial, sans-serif;` and `--font-heading` the same. Remove the Geist imports.
For `next/font/local` details, read the version-matched docs in `app/node_modules/next/dist/docs/` (search for `font`), or Context7 `/vercel/next.js`.

ADR-004 §3.4 design tokens (map into `globals.css` `:root` shadcn variables; values are hex — replace the generated oklch values):

| shadcn / app variable | Value |
|---|---|
| `--primary` | `#E2007A` |
| `--primary-foreground` | `#FFFFFF` |
| `--background` | `#FFFFFF` |
| `--card`, `--popover` | `#FFFFFF` (foregrounds `#000000`) |
| `--muted` | `#FAFAFA` |
| `--muted-foreground` | `#555555` |
| `--foreground` | `#000000` |
| `--border`, `--input` | `#B7B7B7` |
| `--accent` | `#DCF3F4` (foreground `#000000`) |
| `--secondary` | `#FAFAFA` (foreground `#000000`) |
| `--ring` | `#E2007A` |
| `--destructive` | `#B3261E` (never magenta for errors) |
| `--radius` | `0.3125rem` (5 px inputs); buttons 4 px; cards 20 px |

Also add app tokens in `@theme inline` (so Tailwind classes like `bg-status-approved-bg` exist):
- approved: bg `#E7F5EC`, text `#1B6B36`, border `#1B6B36`
- rejected / field errors: bg `#FDECEC`, text `#B3261E`, border `#B3261E`
- review: bg `#FFF7D1`, text `#6B4E00`, border `#C9A400`
- info / processing: bg `#DCF3F4`, text `#000000`, border `#73DADF`
- `--shadow-card: 0 10px 24px rgba(33,33,33,.10)`; `--radius-card: 20px`; `--radius-button: 4px`
Remove the `.dark` block and the dark custom variant (no dark mode in the PoC). Keep `@import "shadcn/tailwind.css"` and `tw-animate-css`.
Visual rules: white background, black text, magenta primary button with white 16 px/600 text and min height 44 px, turquoise only for borders/decoration, 4 px spacing grid. Read `docs/design-guidelines.md` and `assets/design-tokens.json` for typography sizes and header styling, and look at `assets/homepage.png` (the brand reference) for logo placement in the header.

The `TooltipProvider` from `@/components/ui/tooltip` should wrap `{children}` in `layout.tsx` (shadcn tooltip requires it).

## TDD steps
1. Rewrite `app/tests/e2e/smoke.spec.ts` first (Playwright, real production server; no `page.route`, no mocks). For `/` assert: response 200; `html[lang="pl"]`; `getComputedStyle(document.body).fontFamily` contains "Titillium"; after `document.fonts.ready`, `document.fonts.check('16px "Titillium Web"')` or equivalent shows the font loaded (if the family name next/font generates differs, assert on the computed family including the next/font generated name containing "Titillium" — report what you used); `getByRole("img", { name: "Logo" })` visible; `getByRole("heading", ...)` or text with the intro sentence visible; no console errors/page errors; at a 360×740 viewport `document.documentElement.scrollWidth <= 360`.
2. Run it red: from `app/`: `npm run build && npx playwright test smoke --project=chromium` (the config starts three `next start` instances on ports 3000–3002; no `.env.local` is needed yet). Record the failure (lang is `en`, font is Geist).
3. Implement the files above.
4. Green, recorded separately: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npx playwright test smoke --project=chromium --project=mobile-360` (firefox may also be run; WebKit lacks host libraries on this machine — skip it).
5. Screenshots with Playwright (a small one-off script via `node -e` or a spec run is fine, but do not leave extra spec files): start `npx next start -p 3000` from `app/`, capture full-page screenshots at 1280×800 → `docs/qa/screenshots/T03-01-shell-desktop.png` and 360×740 → `docs/qa/screenshots/T03-02-shell-360.png` (create the folder). Stop the server afterwards (`pkill -f "next start"`).
6. Compare the screenshots with `assets/homepage.png` (open both images with your Read tool) for colors, font, logo placement; describe differences in the report.

## Rules
- Library facts: Context7 first (`resolve-library-id` → `query-docs`) or the bundled Next docs; CLI facts: `--help`.
- No `any`, no type assertions (`as`, `as const`). ESLint enforces it.
- `curl`/`wget`/`sudo` are denied; use Node `fetch` if you need an HTTP probe.
- Report contradictions instead of guessing. Do not commit; the orchestrator reviews and commits.

## Report
Files changed; red run failure; final outputs of each green command (counts, skips); screenshot paths and your comparison with `assets/homepage.png`; assumptions.
