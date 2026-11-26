# Coordinator verification

Subagent reports are leads, not evidence. Before a number goes into a chart or a TL;DR, read it yourself in the raw source.

Use option B (browser) by default. In auto mode, Bash network access was blocked in the reference session, while the browser worked.

## Option A: script (when Bash may fetch URLs)

```bash
python3 -I .claude/skills/deep-source-research/scripts/extract_tables.py 2608.01395 "Table 4" --rows "en|pl|cs" --csv /path/to/scratchpad/research/RAW-2608.01395-table4.csv
```

- The first argument is an arXiv ID (optionally with a version, e.g. `2412.00559v2`) or a full URL of an arXiv or ar5iv HTML page.
- The second argument is a regex matched against the table caption, e.g. `"^Table 4"`.
- `--rows` keeps rows whose first cell matches the regex. Header rows are always kept.
- It also prints the caption, so you can quote it.

If network access from Bash is blocked, use option B.

## Option B: built-in browser DOM extraction

Navigate with `mcp__Claude_Browser__navigate` to `https://arxiv.org/html/<id>`, then run this with `mcp__Claude_Browser__javascript_tool`:

```js
const out=[]; for(const tb of document.querySelectorAll('figure.ltx_table')){
  const cap=((tb.querySelector('figcaption')||{}).innerText||'').trim();
  if(/^Table 4/.test(cap)){ out.push(cap.slice(0,300));
    out.push([...tb.querySelectorAll('tr')].map(r=>[...r.cells].map(c=>c.innerText.trim()).join(' | ')).join('\n')) } }
out.join('\n')
```

To verify a quoted sentence:

```js
const t=document.body.innerText; ["88%","83.9"].map(p=>{const i=t.indexOf(p);return p+" => "+(i<0?"NOT FOUND":t.slice(Math.max(0,i-200),i+150).replace(/\s+/g," "))}).join("\n\n")
```

Notes:
- A browser tab showing a local `file://` page cannot navigate away. Navigation then opens a new tab, so pass its `tabId` to later calls.
- Model lists often live in Table 1 of a paper. Extract it too, so the charts can name model versions.

## Comparability checklist (label every study)

| Label | Meaning | Interpretation risk |
|---|---|---|
| Parallel (official translation) | Same items, human or expert translation | Lowest. This is the cleanest same-model comparison |
| Machine-translated | Target-language version produced by MT | The gap mixes language effect with translation quality |
| Native-origin translated *out* | Written in the target language, translated to English | The target language has a home advantage (culture, nuance) |
| Non-parallel | Each language has its own content, e.g. its own Wikipedia | Difficulty differs by language, so only the direction is informative |
| Native-only | No English arm | Cannot answer "X vs English" at all |

Also check for each study:
- Which part was varied: instructions, content, reasoning language, or output language.
- Model generation. Results from early 2025 may not hold for 2026 models, so prefer the newest.
- Significance tests, or their absence.
- The metric's bias. For example, strict lexical match penalises inflected languages such as Polish.
