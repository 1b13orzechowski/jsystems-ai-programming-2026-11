# Brief T16a — Decision chat screen components (no network; part of T16)

T16 is split while the OpenRouter key is being fixed: this part builds the presentational chat screen driven by props. `ChatPanel` with `useChat` + `DefaultChatTransport` (its tests replay real `/api/chat` captures) follows in T16b. `page.tsx` wiring is T17.

## Goal and observable outcome
Polish, accessible components that render the case summary, the message list with the decision card (initial and updated), assistant markdown, the chat input without attachments, typing indicator, chat error with retry and the new-case dialog (PRD 9.2, AC-21…AC-32 UI parts, AC-33, AC-35).

## Editable files
- `app/src/components/decision-chat/decision-card.tsx`
- `app/src/components/decision-chat/decision-badge.tsx`
- `app/src/components/decision-chat/assistant-text.tsx`
- `app/src/components/decision-chat/case-summary.tsx`
- `app/src/components/decision-chat/chat-messages.tsx`
- `app/src/components/decision-chat/chat-input.tsx`
- `app/src/components/decision-chat/typing-indicator.tsx`
- `app/src/components/decision-chat/chat-error.tsx`
- `app/src/components/decision-chat/new-case-dialog.tsx`
- `app/tests/unit/decision-chat/*.test.tsx`

## Read first
- `docs/PRD.md` §4.4, §4.7, §6 AC-21…AC-33, AC-35, §9.2, §11.4.
- `docs/ADR/004-frontend.md` §3.1 (components), §3.3 (part rendering rules), §3.4 (status colors; badge = icon + text + color, never color alone; contrast ≥ 4.5:1), TAC-004-03/05.
- **UI contract**: section "UI contract the specs rely on" in `docs/.agent-briefs/poc-implementation-plan-T18-specs.md`, and the committed E2E specs `app/tests/e2e/{return-flow,complaint-chat,chat-errors,session,window-guardrails}.spec.ts` with `helpers/{decision,chat}.ts` — match their selectors exactly: `data-testid="case-summary"`; message list `role="list"` with accessible name `COPY.chat.messagesLabel`; each message `role="listitem"` with `data-testid="chat-message"` and `data-role="assistant" | "user"`; decision card `data-testid="decision-card"`, `data-decision-label`, `data-decision-kind`, heading `COPY.decision.title` / `updatedTitle`, label text from `COPY.decision.labels`, `COPY.decision.justification`, `<ol>` steps under `COPY.decision.nextSteps`, disclaimer `decision.disclaimerPl`; chat textbox named `COPY.chat.inputLabel` with counter `x/2000`, button `COPY.chat.send`; typing text `COPY.chat.typing`; error `COPY.chat.error` + button `COPY.chat.retry`; dialog `role="dialog"` titled `COPY.newCaseDialog.title` with buttons `cancel`/`confirm`.
- Existing: `@/lib/domain/schemas` (`ChatUIMessage`, `Decision`, `CaseInput`, `CHAT_MESSAGE_MAX`), `@/lib/domain/copy-pl` (`COPY` — every visible/ARIA string; guard test fails on literals), shadcn/AI Elements building blocks in `@/components/ui/*`: `message`, `message-scroller`, `bubble`, `input-group`, `textarea`, `button`, `badge`, `card`, `dialog`, `spinner` — read their source for props. `streamdown@2.8.1` for markdown (Context7 or `node_modules/streamdown` types).

## Component API
- `DecisionBadge({ label })`: icon (lucide: check for zaakceptowano, x for odrzucono, alert/clock for wymaga_weryfikacji, `aria-hidden`) + text `COPY.decision.labels[label]`, colors `status-approved-*` / `status-rejected-*` / `status-review-*`.
- `DecisionCard({ decision })`: `kind === "updated"` → heading `COPY.decision.updatedTitle`, else `title`; badge; "Uzasadnienie" + justification; cited rules (`COPY.decision.citedRules`: IDs joined); optional `COPY.decision.photoProblem` + `photoProblemPl`; optional `COPY.decision.changeReason` + `changeReasonPl` (updated); `COPY.decision.nextSteps` + `<ol>` of steps; disclaimer in muted text. Card: white, 20 px radius, card shadow.
- `AssistantText({ text })`: Streamdown markdown (headings, bold, lists); no raw `**`/`##` visible (AC-29). If `globals.css` needs `@source "../node_modules/streamdown/dist/*.js";` for Streamdown classes, **report it** (orchestrator edits globals.css).
- `CaseSummary({ input, photoUrl })`: read-only case type (`COPY.caseTypes`), category, model, purchase date formatted `dd.MM.yyyy`, reason clamped to 3 lines with "Pokaż więcej"/"Pokaż mniej" (or `COPY.summary.noReason`), thumbnail button `COPY.summary.photoOpen` opening a shadcn Dialog with the large image (`alt` `COPY.summary.photoAlt`). Collapsible on mobile (toggle `COPY.summary.toggle`), side column ≥ 1024 px (layout classes; the parent decides placement).
- `ChatMessages({ messages, status, error, onRetry })` where `messages: ChatUIMessage[]`, `status: "ready" | "submitted" | "streaming" | "error"`: list per contract; assistant left, user right (bubbles); part rendering per ADR-004 §3.3: `text` → `AssistantText` (assistant) / plain text (user); `data-decision` → `DecisionCard`; `tool-issueUpdatedDecision` with `state === "output-available"` → `DecisionCard` of `part.output`; other tool states → nothing. `TypingIndicator` when `status === "submitted"` or streaming with no assistant text yet (AC-23). `ChatError` under the last user message when `error` is set (AC-28). Auto-scroll to newest (use `message-scroller` building block if practical).
- `ChatInput({ disabled, onSend })`: textarea named `COPY.chat.inputLabel`, `maxLength={2000}`, counter `COPY.chat.counter(len, 2000)`, send button `COPY.chat.send` (44 px min height); Enter sends, Shift+Enter newline; empty/whitespace not sent (AC-22); disabled while `disabled` (AC-23); **no file input, no attach button, drops ignored** (AC-27). After send, clears the field.
- `TypingIndicator()`: `COPY.chat.typing` with shimmer, `aria-live="polite"`.
- `ChatError({ onRetry })`: `COPY.chat.error` (role="alert") + button `COPY.chat.retry`.
- `NewCaseDialog({ open, onOpenChange, onConfirm })`: shadcn Dialog with `COPY.newCaseDialog.title`, `description`, buttons `cancel` (closes) / `confirm` (calls `onConfirm`). The shadcn dialog close "X" must have a Polish accessible name (`COPY.summary.close`) — if the vendor component renders English text ("Close"), hide its default close button via its props/className or report it; do not edit `ui/*`.
Mark files using state/events with `"use client"`.

## TDD (RTL + user-event, write first; red because files are missing)
From ADR-004 §8: decision card for the three labels → distinct badge text + icon + color class, disclaimer present; updated kind shows `COPY.decision.updatedTitle` and change reason; markdown `"**pogrubienie**\n\n1. krok"` → `<strong>` and `<ol>`, no `**` visible; chat input whitespace not sent, Shift+Enter newline, Enter sends trimmed text, disabled while `disabled`, counter; no file input or attach button in ChatInput; ChatMessages renders the contract attributes, a `data-decision` part as a card, a `tool-issueUpdatedDecision` `output-available` part as an updated card, ignores other tool states, shows typing indicator for `submitted`, shows ChatError + retry calls `onRetry` when `error` is set and keeps the user message; NewCaseDialog confirm/cancel; CaseSummary shows formatted date `dd.MM.yyyy`, "Pokaż więcej" toggle, photo dialog. Build `ChatUIMessage` test data by hand with synthetic Polish text and a `Decision` that includes `disclaimerPl: DECISION_DISCLAIMER_PL` (this is UI test data, not an endpoint mock; the endpoint replay comes in T16b).
Then `npm run test`, `npm run typecheck`, `npm run lint`.

## Rules
- Repository root: `/home/labuser/jsystems-ai-programming-2026-11/.claude/worktrees/skills-lock`; npm commands in `app/`. React 19, Next 16, Tailwind 4 (status tokens in `src/app/globals.css`), shadcn Radix, AI SDK 7 types (`ai`), `@ai-sdk/react` is NOT used in this part.
- Library facts: Context7 (`/vercel/ai` for UIMessage part types, streamdown docs) — never guess APIs.
- No `any`, no type assertions (`as`, `as const`); no letter-containing literals in JSX text or `aria-label`/`alt`/`placeholder`/`title` — use `COPY`. No browser storage. No imports from `@/lib/ai`, `@/lib/security`, `@/lib/server`, `@/lib/env`.
- Edit only the listed files. Never `npm install`, never touch `package.json`, lockfile, configs, `globals.css`, `layout.tsx`, `page.tsx`, `src/components/ui/*`, shared contracts, docs. `curl`, `wget`, `sudo` denied. Do not start `next start` servers.
- Concurrent work (do not edit): T15a `app/src/components/case-form/*`, `app/tests/unit/case-form/*`; orchestrator `app/scripts/*`, `app/tests/fixtures/*`, `app/src/lib/ai/*`.
- Report contradictions instead of guessing. Do not commit.

## Report
Files; red run reason; final `npm run test` (counts, skips), `typecheck`, `lint`; assumptions/contradictions; contract points you could not meet; any change needed in `globals.css` or `ui/*`.
