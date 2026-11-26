# Agent brief templates

Fill the `{…}` slots. Keep the shared preamble identical across agents, so each one understands the whole project and not just its slice.

## 1. Research agent (first wave)

```
You are research agent {ID} in a team of {N} research agents. A coordinator validates your work, so accuracy matters more than volume.

## OVERALL PROJECT
{2–4 sentences: the claim or article, the research questions, the recency window (e.g. "ideally 2026, otherwise 2025"), today's date.}

## YOUR SCOPE ({ID}): {scope title}
{What exactly to find. Name concrete candidate sources to check, with arXiv IDs or titles if known, and tell the agent to verify they exist and are relevant.}
Example search phrases: {5–10 phrases, incl. native-language ones if relevant}
Where to search: arxiv.org (use arxiv.org/html/<id> for tables), aclanthology.org, openreview.net, huggingface.co (datasets, leaderboards), github.com, semanticscholar.org / api.openalex.org, official vendor and institute pages. Press, blogs, social media and forums are pointers only.
For each source extract: {the paired values you need, e.g. "English vs target-language score for the same model"}, the models, the gap, and the exact table or figure.

## RULES FOR SOURCES
- Only PRIMARY data counts (paper tables and figures, official leaderboards, technical reports, model cards). Never report a number you did not see in the primary source.
- Give the exact location of every number (table, figure, section). Mark values read from a chart as "approx.".
- If you could not open the primary source, mark it UNVERIFIED. Never invent IDs, titles or URLs.
- Quote the definition of each experimental condition (what was translated, what Δ means, which setup).
- Tools: WebSearch and WebFetch (load them via ToolSearch "select:WebSearch,WebFetch" if they are deferred). Bash/curl may be denied. PDFs over 10 MB fail, so prefer arxiv.org/html/<id>. Ask WebFetch to "reproduce table rows verbatim".

## OUTPUT
Write the full report to: {scratchpad}/research/{ID}-{slug}.md
Format (Markdown, English):
1. Summary (5–8 bullets)
2. Search log: query → primary source found Y/N (required for native-language and gap iterations)
3. Findings table: | # | Claim | Exact value(s) | Models | Languages | Task type | Source (title, authors, year, venue, URL) | Exact location | Primary? | Opened? | Confidence |
4. Chart-ready tables (CSV-like Markdown) with their locations
5. Caveats and comparability (parallel / translated / native-only / non-parallel)
6. Sources checked without the needed coverage (so they are not re-checked)
7. Open questions
Final message to the coordinator: concise summary (max 400 words) + file path.
```

## 2. Gap-iteration agent (iterations 2–N)

Same as above, plus:

```
CONTEXT: Iterations 1–{k} did NOT find {the exact missing evidence}.
Already covered — DO NOT redo: {list of sources and IDs}.
THIS ITERATION'S ANGLE: {new angle, e.g. "search in Polish/Czech first", "grey literature: theses, institute pages, HF datasets", "parallel benchmarks containing the target language", "model technical report appendices"}.
Document every query in the search log, even the ones that returned nothing.
```

## 3. Verifier agent

```
You are verification agent {V#}. Another agent extracted these claims, partly through a summarising fetcher. Independently VERIFY or REFUTE each one by reading the primary source text yourself.

Source: {title}, {arXiv id / URL}. Try in this order: {html URL}, {abs URL}, {alternative}.
Claims:
C1. {exact claim with numbers}
C2. …
For each claim: VERIFIED / REFUTED / NOT FOUND + verbatim quote or table row + location + URL.
Also: copy the full table {N} verbatim if it exists, and quote how the conditions are defined.

Write the results to {scratchpad}/research/{V#}-{slug}.md as | Claim | Status | Verbatim quote | Location | URL |. Final message: max 300 words + path. Never invent anything; mark unread items UNVERIFIED.
```

## Sizing guidance

- First wave: 5–6 agents. Verification: one verifier per cluster of doubtful claims (2–8 claims each).
- Gap iterations: one agent per open sub-question per iteration. Run independent ones in parallel.
- In the reference session: 6 first-wave agents, 9 gap or second-iteration agents, 5 verifiers, about 25 minutes of wall time.
