# Hardware Service Decision Copilot (PoC)

Internal proof of concept: a store employee describes a returned or complained-about device, uploads a photo, and gets a policy-based decision (accepted / rejected / manual review) with a follow-up chat. Specification: [`../docs/PRD.md`](../docs/PRD.md), architecture: [`../docs/ADR/`](../docs/ADR/).

## Getting started

Requirements: Node.js 24, npm.

```bash
cd app
npm ci
cp .env.example .env.local   # fill in OPENROUTER_API_KEY and CASE_SIGNING_SECRET (openssl rand -base64 32)
npm run dev                  # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run dev` | Development server (Turbopack) |
| `npm run build` / `npm run start` | Production build / server on port 3000 |
| `npm run lint` | ESLint (no `any`, no type assertions) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest: `unit` (jsdom) and `integration` (node), network blocked |
| `npm run test:e2e` | Build, start three real instances (3000, 3001 invalid key, 3002 1 s budget) and run Playwright; needs `.env.local` with a real key |

First-time E2E setup: `npx playwright install chromium firefox webkit` (WebKit also needs system libraries: `sudo npx playwright install-deps`).

## Scaffold checklist

Carried over from the course scaffold README (ADR-001 Step 1).

### Project setup
- [x] Choose framework — Next.js 16 ([ADR-000](../docs/ADR/000-main-architecture.md), [ADR-001](../docs/ADR/001-project-setup.md))
- [x] Initialize project (`create-next-app@16.4.6`)
- [x] TypeScript config (`tsconfig.json`, strict + extra flags)
- [x] Package manager chosen (npm)

### Code quality
- [x] ESLint config (`eslint.config.mjs`)
- [ ] Prettier config (not adopted for the PoC)
- [ ] `.editorconfig` (optional)

### Testing
- [x] Unit/integration test runner (Vitest 5, `vitest.config.mts`)
- [x] E2E test runner (Playwright, `playwright.config.ts`)
- [x] Test setup files (`tests/setup/`)

### Environment
- [x] `.env.example` with required env vars
- [ ] `.env.local` created locally (gitignored; each developer)
- [x] `.gitignore`

### AI integration
- [x] Vercel AI SDK (`ai` 7) with `@openrouter/ai-sdk-provider`
- [ ] API route / endpoint for chat (`/api/chat`)
- [ ] Model configuration (`src/lib/ai/models.ts`, env-driven)

### Design
- [ ] Design tokens mapped into `globals.css` (`../assets/design-tokens.json`)
- [x] Tailwind CSS 4
- [ ] Logo and favicon (`../assets/`)
- [x] Design system doc (`../docs/design-guidelines.md`)

### Documentation
- [x] PRD (`../docs/PRD.md`)
- [x] ADRs (`../docs/ADR/`)
- [x] `AGENTS.md` in `app/` with stack-specific rules
