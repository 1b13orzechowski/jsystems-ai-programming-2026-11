<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Stack rules for this app (ADR-001 Step 9)

- Commands (run in `app/`): `npm run dev | build | start | lint | typecheck | test | test:e2e`. `test:e2e` builds once, then starts three real instances (3000 primary, 3001 invalid key, 3002 1 s test budget); it needs `app/.env.local`.
- Stack: Next.js 16 (App Router, `src/`), React 19, Tailwind 4, shadcn/ui (Radix base, style `radix-nova`), AI SDK 7, `@openrouter/ai-sdk-provider`, Zod 4, Vitest 5 (`unit` jsdom / `integration` node), Playwright.
- AI SDK 7: read `/vercel/ai` docs through Context7; do not use AI SDK v5/v6 names.
- Never import `src/lib/ai`, `src/lib/security`, `src/lib/server` or `src/lib/env.ts` from client components; they are `server-only`.
- All UI strings come from `src/lib/domain/copy-pl.ts` (Polish UI).
- Policy files live in `content/policies/` and are loaded server-side.
- No `any`, no type assertions (`as`, including `as const`): ESLint enforces it outside `src/components/ui/**`. Use Zod parsing, type guards and `satisfies`.
- shadcn and AI Elements building blocks (`message`, `message-scroller`, `bubble`, `input-group`, `spinner`) live in `src/components/ui/` as owned vendor code; do not add new assertions there. Add components with `npx shadcn@4.23.0 add <name>`.
- Unit/integration tests have network access blocked (`tests/setup/no-network.ts`); endpoint mocks replay real captures from `tests/fixtures/captures/` only. E2E never intercepts requests.
