---
name: deep-source-research
description: Evidence-first research workflow that traces a claim, article or question back to primary sources (papers, technical reports, official benchmark tables), runs parallel research subagents plus independent verifier subagents, iterates on gaps (default max 5 iterations), then writes bilingual Markdown reports and interactive chart artifacts into a repo folder the user picks, and commits them. Use this whenever the user asks to find the source behind an article or claim, fact-check a popular-science or media statement against data, "znajdź źródło raportu", "zweryfikuj tezę", "zrób research na podstawie danych źródłowych", compare studies or benchmarks, or wants a research report with charts — even if they do not say "skill", "subagents" or "deep research".
---

# Deep source research

A coordinator-led process: you plan, delegate, validate and write. Subagents search and verify. Every number that reaches the final report must be confirmed by you in the primary source.

This skill was distilled from a real session ("Is Polish better than English for prompting LLMs?"). The reference output lives in `docs/research/polish-vs-english-llms/` in this repo. Open it when you need a concrete example of the report, data folder or artifact builder.

## Defaults (override from the user's request or skill args)

| Setting | Default |
|---|---|
| Max search iterations per open sub-question | 5 |
| Subagent model | `haiku` for search and verification, your own model for coordination |
| First-wave agents | 5–6 in parallel, one per scope |
| Report languages | Polish + English (Markdown and artifact for each) |
| Output folder | asked from the user, suggest `docs/research/<topic-slug>/` |
| Git | commit named paths at the end; push only if the user asks |

## Phase 0 — Clarify before spending tokens (one question round)

Ask everything in a single `AskUserQuestion` call so the user answers once:

1. **Output folder** in the repo. This is required. Offer `docs/research/<slug>/` as the recommended option.
2. **The source material**, if the user refers to "this article" or "this report" but attached nothing. Ask for a link or title. Otherwise state your best guess and make verifying it the first agent's job. In the reference session no article was attached. The guess was right, but it was never confirmed.
3. Optional: report languages, iteration limit, and recency window, e.g. "prefer 2026, accept 2025".

Then restate the research questions as 3–6 numbered sub-questions. Each sub-question is tracked separately through the iterations.

## Phase 1 — First wave of research agents (parallel, background)

Spawn one `general-purpose` agent per scope with `model: "haiku"` and `run_in_background: true`, all in a single message. Build every prompt from `references/agent-briefs.md`: a shared project preamble, the agent's scope, example search phrases and places, source rules, and the output file and format.

Typical scopes; adapt them to the topic:
- **A1 Source.** Identify the original study behind the article, with exact numbers, versions, venue and caveats, and how the media framed it.
- **A2–A4 Topical areas.** One agent per sub-question area, e.g. reasoning, retrieval/RAG, agents.
- **A5 Native-language sources.** Search in the languages of the topic, e.g. Polish, Czech, Ukrainian, with queries written in those languages. Ask for a search log.
- **A6 Critiques and replications.** Papers citing the source (Semantic Scholar / OpenAlex), expert comments, reviewer critiques.

Each agent writes its full report to `<scratchpad>/research/<ID>-<scope>.md` and returns at most ~400 words. That keeps your context small, and you read the files only when you need them.

While agents run, load the `artifact-design` and `dataviz` skills. They are needed later and loading them now costs nothing.

## Phase 2 — Validate every hand-back (you are the quality gate)

For each report:

1. **Classify the claims.** Primary and opened by the agent, snippet-only, or press only. Drop snippet-only numbers from charts until they are verified.
2. **Send doubts to a verifier agent.** Do not search yourself. Build its prompt from the verifier brief in `references/agent-briefs.md`. Give it the exact claims as a checklist (C1, C2, …) and ask for VERIFIED / REFUTED / NOT FOUND, a verbatim quote, and the location of each.
3. **Re-read key numbers yourself from the raw source.** Use the built-in browser DOM snippet in `references/verification.md`. It is the default, because it worked when Bash network access was blocked. Use `scripts/extract_tables.py` where Bash may fetch URLs. This step is not optional. In the reference session, verifiers themselves introduced errors (see "Lessons learned"), and only the raw-table check caught them.
4. **Save confirmed tables as CSV** in `<scratchpad>/research/RAW-<arxiv-id>-<table>.csv`. Put a header comment with the source, table number, extraction date and comparability notes. These files become the report's `data/` folder.

## Phase 3 — Iterate on gaps (max N, default 5)

Keep a small gap tracker per sub-question: iteration count, what was searched, and what is still missing.

- Each new iteration gets a fresh agent with *different* sources, phrases and languages. Include an explicit "already covered — do not redo" list. Repeating the same search wastes an iteration.
- Run independent gap iterations in parallel. In the reference session, iterations 4 and 5 ran side by side, which halved the wait.
- Change the angle between iterations. Examples:
  - English academic → native-language queries → grey literature (theses, institute pages, Hugging Face, GitHub).
  - Then parallel benchmarks that include the target language.
  - Then model technical reports and their appendices.
- Stop a sub-question when it is answered with primary data, or when the iteration limit is reached. Only then report "no data found", and list where you looked.

## Phase 4 — Write the reports (only after the data is final)

Write the reports only once iterations and verification are done. Writing early forces repeated patches across 4 files (2 Markdown, 2 HTML); see "Lessons learned".

Order:

1. `report.en.md`, the canonical version. Use the structure in `references/report-structure.md`: TL;DR, source analysis, evidence by area with tables, answer matrix with evidence strength, practical recommendations, method and verification, sources.
2. `report.<lang>.md` for each further language. Translate it in full, and use local number formats such as `83,9` in Polish.
3. `data/*.csv`, copied from the scratchpad RAW files.
4. Count the agents and iterations at the end, from your own tool calls, and only then write those numbers into the reports.

## Phase 5 — Interactive artifacts (one per language)

- Follow the loaded `artifact-design` and `dataviz` guidance: tokens for light and dark mode, the validated categorical palette, one color per entity, a legend, and hover tooltips.
- **Single source of truth.** Write one `generator/template.html` with `[[key]]` placeholders and one `generator/build.py` that holds an i18n dictionary per language and the shared data. It renders `artifact.<lang>.html`. A fix then happens once, not twice. The reference builder is `docs/research/polish-vs-english-llms/generator/`.
- Useful interactive pieces:
  - Model or study selector chips that re-sort a bar chart.
  - A paired "same model, two conditions" dumbbell chart with a delta column.
  - A media-framing vs paper-says toggle.
  - A small calculator, e.g. a token-cost calculator.
  - An answer matrix with state pills.
- Every chart carries a source line naming the table, and a note on comparability (parallel vs translated vs native content).
- Check the rendered page once (`mcp__Claude_Browser__preview_start` with a `file://` URL plus one screenshot or DOM check), fix what you see, then publish each file with the `Artifact` tool. Artifacts are private, so tell the user they must use Share before others can open them.

## Phase 6 — Commit

1. `git status`, then stage only the output folder by name. Never use `git add -A` or `git add .`.
2. Commit with the repository convention `Docs: <summary>` and the attribution trailer the session requires.
3. Push only when the user asks. On a new branch, use `git push -u origin <branch>`.
4. If the branch had no commits yet, say so, because a push without a commit sends nothing new.

## Final message to the user

Keep it short:
- The answer to their question in 3–5 bullets.
- Links to both artifacts and the files.
- What was verified and how, which errors the verification caught, and the remaining gaps.
- The commit hash.

## Lessons learned (avoid these)

1. **Summarising fetchers distort numbers.** WebFetch returns a model's summary, not raw text. Haiku agents reported correct numbers with wrong meanings. A verifier "corrected" a sentence into an error: it said *aggregate*, but the paper says *English S-NIAH*. Remedy: confirm every charted number in the raw HTML table with the extractor script or DOM snippet.
2. **Misread experimental conditions.** "94.5% → 41.0%" was first reported as "native-language prompt is worse". In fact only the *instructions* were translated, and the content stayed in Czech. Always ask agents to quote the condition definitions: which part was translated, and what "Δ" means.
3. **Paraphrased mechanisms.** "Forcing English *thinking*" was really "language control in the *instructions*". Quote the table caption and describe exactly that.
4. **Generalising from one old measurement.** A single 2023 tokenizer gave "1.8× more tokens", while modern tokenizers give 1.3–1.8×. Prefer the newest models, and report ranges.
5. **Snippet-only and hallucinated IDs.** Some arXiv IDs existed only in search snippets. Require "Opened? Y/N" in every findings table, and verify existence before citing.
6. **Tool limits.** Subagents, and even the coordinator in auto mode, may have network access from Bash denied. The built-in browser still works. and arXiv PDFs over 10 MB fail in WebFetch. Tell agents upfront to use `arxiv.org/html/<id>` (or `/html/<id>v2`), the abstract page for metadata, and the Semantic Scholar or OpenAlex APIs for citations.
7. **Comparability.** Label every study as parallel (same items, official translation), machine-translated, native-only, or non-parallel. Mixing these without labels misleads.
8. **Anomalies in the source.** Some odd values are in the paper itself, e.g. GPT-4o EN 59.9 < CS 70.1 in MMLU-ProX. Check the raw table before calling it a transcription error. Then mention it and exclude it from conclusions.
9. **Late edits multiply.** Report counts and claims changed after the reports were written, which meant 4 rounds of sed and python patches. Finish the data, then write.
10. **Ignored folders silently drop files.** In the reference session, the artifact generator lived in `build/`, which this repo's `.gitignore` excludes, so the first commit lacked it. Before committing, run `git check-ignore -v <folder>/*` and `git show --stat HEAD` after committing. Name the folder `generator/`, not `build/`.
11. **Repo conventions for skills.** This repo commits skills in `.agents/skills/` and keeps `.claude/skills/` as symlinks, which are gitignored. Read `.gitignore` comments before choosing a location.
12. **Media pointers are not evidence.** Use press only to find the primary source and to describe the framing. An attributed quote from an author is fine, if you mark it as press-reported.

## Bundled resources

- `references/agent-briefs.md`: templates for research, gap-iteration and verifier agent prompts. Read it before Phase 1.
- `references/verification.md`: how to extract raw tables (script, browser snippet) and the comparability checklist. Read it before Phase 2.
- `references/report-structure.md`: the Markdown report outline and artifact section plan. Read it before Phase 4.
- `scripts/extract_tables.py`: fetches an arXiv HTML page and prints the tables whose caption matches a pattern. Usage: `python3 -I scripts/extract_tables.py 2503.10497 "Table 3" [--rows "EN|PL|CS"] [--csv out.csv]`.
