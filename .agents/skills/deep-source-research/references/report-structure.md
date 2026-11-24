# Report structure

## Folder layout (in the folder the user chose)

```
<folder>/
├── report.en.md          canonical report
├── report.<lang>.md      full translation(s), with local number format
├── artifact.en.html      interactive page (published via the Artifact tool)
├── artifact.<lang>.html
├── generator/
│   ├── template.html     one template with [[key]] placeholders
│   └── build.py          i18n dicts + shared data → artifact.<lang>.html
└── data/
    └── <source-id>-<table>.csv   verified extracts with a header comment (source, table, date, caveats)
```

Reference implementation: `docs/research/polish-vs-english-llms/`. Copy `generator/` from there, then replace the content and data.

## Markdown report outline

1. **Title as a question**, plus date and context line.
2. **TL;DR**: 4–6 bullets covering the source, what it really measured, what newer data says, the mechanism or "why", and cost or practical implications.
3. **The original source**: a table of claim | value | exact location; limitations as a numbered list; how the media framed it, with pointer links.
4. **Evidence by area**: one subsection per sub-question. Each one has a short table (same model, two conditions, Δ column), a source line with the table number, and one or two sentences of interpretation with its comparability label.
5. **Answer matrix**: question | answer | strength of evidence (high / medium / low). Then practical recommendations as a numbered list.
6. **Method and verification**: the agents, the iterations, what the coordinator re-read in the raw sources, errors caught by verification, and remaining gaps.
7. **Sources**: numbered primary sources with arXiv IDs, then press pointers separately.

## Artifact section plan

Follow the order of the Markdown report, so the two read as one product:

1. Hero: the question as the H1; a two-column "headline vs what the paper measured"; a one-paragraph verdict.
2. A sticky section index.
3. Source section with a media-vs-paper toggle and fact cards.
4. One interactive chart per evidence area: selector chips, then bars or dumbbells, a summary sentence computed from the data, a legend, tooltips, and a source line.
5. A calculator, if a cost or size question exists.
6. The answer matrix with state pills, and recommendations.
7. Method steps, the errors caught, and sources with a "table checked" badge.

Implementation notes that saved time:
- Format numbers with `Intl.NumberFormat` per locale, and use `sgn()` with a true minus sign for deltas.
- Size each chart from its container width and redraw on resize. Do not use a fixed viewBox, because text shrinks on phones.
- Keep per-viewer chip selections in `localStorage`, wrapped in try/catch.
- Use the `<title>` as the page name, a short question. It must differ per language.
