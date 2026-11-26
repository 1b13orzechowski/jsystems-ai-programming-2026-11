# Is Polish a better language for prompting LLMs than English?

Research report, 24 November 2026. Prepared for the JSystems "AI for programmers" course.

## TL;DR

- **The source.** The 2025 news stories saying "Polish is the best language for prompting AI" come from one paper. It is **OneRuler**: Kim, Russell, Karpinska and Iyyer (University of Maryland, Microsoft, UMass Amherst), *"One ruler to measure them all: Benchmarking multilingual long-context language models"*, [arXiv:2503.01996](https://arxiv.org/abs/2503.01996) (v3, 30 Sep 2025; press and secondary sources say COLM 2025).
- **What it measured.** It measured finding facts in very long texts (needle-in-a-haystack, 64K–128K tokens). It did not measure prompting quality, reasoning or agents. On that task Polish had the highest average accuracy (88%), and English was 6th of 26 (83.9%). The models were from early 2025. Each language used a different book as the haystack. Co-author Marzena Karpińska said: "we certainly cannot conclude on its basis that Polish is the best language for prompting" (Science in Poland, 27 Nov 2025).
- **Newer data (2025–2026) does not confirm "Polish > English".**
  - Across retrieval, RAG, knowledge, reasoning and multi-turn agent-like tasks, English is usually equal or better for the same model.
  - With the strongest 2026 models (GPT-5.4, Claude Opus 4.8, Claude Sonnet 5, Qwen3.5), the gap between Polish or other Slavic languages and English is small, usually 0–3 points, and sometimes favours the Slavic language.
  - With smaller or open models the gap is 5–20 points in favour of English.
- **Does language affect the agent's reasoning?** Yes, but the language of the *instructions* and of the *model's thinking* matters more than the language of the *content*. Forcing a model to think in a non-English language costs accuracy. Translating only the instructions into Czech or Ukrainian made some models collapse (Mistral Large: 94.5% → 41.0%). The same Czech content with English instructions kept near-English accuracy.
- **Polish costs more tokens.** The same text in Polish takes **about 1.3–1.8× as many tokens** as in English with common tokenizers (Gemma 3 1.33×, Qwen3 1.68×, Llama 3.2 1.76×). Per word, Polish averages 2.25 tokens vs 1.23 for English. That raises API cost and fills the context window faster.

## 1. The original source and what it really says

| Item | Value | Where (verified by opening the source) |
|---|---|---|
| Paper | Kim, Russell, Karpinska, Iyyer, "One ruler to measure them all…", arXiv 2503.01996 v3 (30 Sep 2025) | arXiv HTML v3, title page |
| Benchmark | 26 languages, 7 models, contexts 8K / 32K / 64K / 128K; tasks: single and multi needle retrieval (NIAH) and common-word extraction (CWE) | Sec. 2–3 |
| Models | Gemini 1.5 Flash, o3-mini-high, Qwen2.5 7B/72B, Llama 3.1 8B, Llama 3.3 70B (+ DeepSeek-R1 for an English-only analysis) | Sec. 3 |
| Headline | "at context lengths of 64K and 128K … Polish is the top performer on NIAH tasks with an average accuracy of 88% across all models" | Sec. 3.1 |
| English | "English is only the 6th best language out of the 26, with an average NIAH accuracy of 83.9%" | Sec. 3.1 |
| Chinese | 4th worst, 62.1% | Sec. 3.1 |
| o3-mini-high, 128K | English 67%, Polish 92%, Ukrainian 89% | Sec. 3.1 |
| "None" option | Adding "if no such number exists, answer none" lowers S-NIAH accuracy by 32% at 128K (English) | Sec. 2 / Fig. 1b |
| Instruction language | Context in English with instructions in Korean: 91% → 71% at 64K. Context in Korean with instructions switched to English: 61% → 77% at 128K | Sec. 4 |
| Controlled for content length | "Slavic languages (Russian, Ukrainian, Polish) perform highly … English performance is even lower, typically 8th" | Appendix D |
| Haystack books differ per language | EN *Little Women* (234K tokens), PL *Noce i dnie* vol. 3 (453K), RU *War and Peace* (1.1M), CS *Švejk* vol. 3 (175K) | Table 4 |

**Limits of the study:**

1. The task is synthetic: finding a planted number in a novel. It is not a test of prompting, reasoning or agents.
2. Each language uses a different book, so the difficulty of the haystack is not controlled.
3. The models are from early 2025.
4. There is no significance test for the Polish–English gap. Press reports quote the co-author saying the difference was not statistically significant. That is a journalist's paraphrase, not a statement in the paper.
5. The paper offers no single cause. The top 10 languages are Slavic, Romance and Germanic languages with large Wikipedia size and Latin script, though Russian and Ukrainian use Cyrillic.

**How the media framed it.** Spider's Web (27 Oct 2025) ran "Polski najlepszym językiem dla botów", and Polskie Radio wrote that chatbots understand Polish instructions better. Both go further than the paper. Science in Poland (PAP, 27 Nov 2025) published the correction with the co-author's quotes. The Spider's Web follow-up (12 Nov 2025) says Microsoft "corrects" the reports, but it quotes no Microsoft spokesperson.

## 2. Newer evidence, by area

All numbers below were re-read by the coordinator from the paper's HTML tables. Each claim lists the table it comes from.

### 2.1 Multi-turn, agent-like tasks: EU-24+ (2026)

Source: Hakimov et al., *"Language Equality has a Price: A Systematic Investigation of Multi-turn LLM Performance for EU-24+"*, [arXiv:2608.01395](https://arxiv.org/abs/2608.01395), Aug 2026, Table 4. The benchmark is 14 interactive dialogue games in 30 languages, scored automatically (clemscore).

| Model | EN | PL | CS | SK | UK | RU | HR | BG |
|---|---|---|---|---|---|---|---|---|
| GPT-5.4 | 91.8 | 89.5 | 90.6 | 90.3 | **93.0** | 89.3 | **93.0** | **92.4** |
| Claude Opus 4.8 | 84.4 | 82.3 | 81.7 | 82.1 | 79.6 | 80.1 | 83.7 | 80.6 |
| GLM-5.2 | 65.6 | 64.3 | 60.1 | 59.4 | **67.0** | 62.3 | 64.2 | **68.9** |
| DeepSeek-V4 | 64.8 | 62.5 | 58.6 | 59.3 | 55.7 | 62.5 | 56.4 | 61.2 |
| Gemma 4 | 50.6 | **59.7** | **52.8** | **53.6** | **56.7** | **58.0** | **55.2** | **60.8** |
| Qwen3.6 | 55.6 | 45.9 | 50.4 | 48.6 | 50.0 | 53.8 | 46.0 | 52.4 |
| **Average of 9 models** | **61.9** | 59.2 | 56.2 | 54.5 | 57.8 | 59.4 | 56.9 | 58.7 |

Bold cells are higher than English for that model.

- English has the highest average of all 30 languages. Polish is 7th, behind Chinese, Dutch, German, Russian and Swedish.
- For frontier models the Polish gap is about 2 points.
- One open model, Gemma 4, scores higher in Polish than in English.

### 2.2 Knowledge and reasoning on parallel exams: Polish medical licensing exams

Source: Grzybowski, Pokrywka, Ciesiółka, Kaczmarek, Kubis, *"Polish-English medical knowledge transfer: A new benchmark and results"*, [arXiv:2412.00559](https://arxiv.org/abs/2412.00559), Findings of EMNLP 2025, Table 4. The English versions are official translations by the exam centre, so the questions are the same.

| Model | LEK PL | LEK EN | Δ (PL−EN) |
|---|---|---|---|
| GPT-4o (2024-08) | 89.96 | 88.69 | **+1.27** |
| Llama-3.1-70B-Instruct | 80.94 | 82.60 | −1.66 |
| Qwen2.5-72B-Instruct | 76.87 | 81.93 | −5.06 |
| Mistral-Large-2407 | 76.75 | 82.40 | −5.65 |
| Bielik-11B-v2.2 (Polish model) | 62.36 | 56.98 | **+5.38** |
| Qwen2.5-7B-Instruct | 51.92 | 67.73 | −15.81 |
| Llama-3.1-8B-Instruct | 51.25 | 64.69 | −13.44 |

- English is better for 12 of the 16 models tested. The authors conclude that models "perform significantly better on English questions" and that the gap "narrows" as models get stronger.
- Polish scores higher only for GPT-4o, the Polish model Bielik and Meditron3-70B. gpt-4o-mini is a tie.

### 2.3 Polish-native content translated to English: PoVisLE (2026)

Source: Kołos et al., *"Jako Tako or Fluent? Presenting PoVisLE: A Polish Vision-Language Evaluation"*, [arXiv:2608.07763](https://arxiv.org/abs/2608.07763), Aug 2026, Table 14. These are questions about Polish culture and language with images, translated to English and German.

| Model | PL | EN (translated) | Δ EN−PL |
|---|---|---|---|
| Qwen3.5-397B (Thinking) | 75.16 | 68.12 | −7.04 |
| Claude Sonnet 5 | 69.94 | 66.94 | −3.00 |
| GPT-5.4 | 68.35 | 70.40 | +2.06 |
| Gemma-4-31B (Thinking) | 72.51 | 72.02 | −0.48 |
| Qwen3.5-9B | 38.75 | 47.04 | +8.29 |

- Polish wins for 8 of 16 models, and English wins for 8.
- On content that is natively Polish, translating to English loses cultural nuance for the strongest models. Small models still gain from English.

### 2.4 Retrieval and RAG

| Evidence | Result | Source |
|---|---|---|
| Reading comprehension over each language's Wikipedia (not parallel content) | F1, EN vs PL: Mistral-Small-3.1-24B Instruct 78.5 vs 64.7; Llama-3.1-8B Instruct 71.4 vs 55.8. Czech and Slovak are about 5–10 points above Polish | MultiWikiQA, [arXiv:2509.04111](https://arxiv.org/abs/2509.04111), Tables 4–6 |
| Multilingual RAG citation accuracy | English evidence is preferred. Russian is lower for all 6 models, by 5.3 to 12.2 points, all significant (e.g. Llama-3.3-70B: 85.9 EN vs 74.5 RU). Polish not tested | "Linguistic Nepotism", [arXiv:2509.13930](https://arxiv.org/abs/2509.13930), Table 1 |
| **RAG with the gold passage in the query language (MKQA, parallel questions)** | Accuracy EN vs PL: Aya-Expanse-8B 87.5 vs 79.2; Gemma-2-9B 79.8 vs 67.8; Qwen2.5-7B 86.0 vs 68.9; Llama-3.2-3B 82.4 vs 60.6. English is higher by 8–22 points. The metric is strict lexical match, which may penalise inflected Polish answers | [arXiv:2504.00597](https://arxiv.org/abs/2504.00597) v4, Table 15 |
| Polish retrieval and embedding benchmarks (PL-MTEB, PIRB, Polish RAG, LREC 2026) | Polish-only, no English counterpart | see `sources` below |

The MKQA study (2025, small open models) is the only same-model Polish vs English RAG comparison we found. We found **no 2025–2026 study that compares RAG on the same documents in Polish and English with frontier models**. This gap remained after five search iterations (see section 4).

### 2.5 Knowledge and reasoning benchmarks in other Slavic languages

Source: MMLU-ProX, [arXiv:2503.10497](https://arxiv.org/abs/2503.10497), Table 3. It covers 29 languages and does not include Polish.

| Model | EN | CS | RU | UK | SR |
|---|---|---|---|---|---|
| Qwen3-235B (Thinking) | 80.7 | 80.5 | 77.0 | 78.8 | 80.2 |
| DeepSeek-R1 | 79.5 | 76.8 | 76.4 | 76.8 | **80.9** |
| GPT-4.1 | 79.8 | 77.5 | 71.2 | 76.4 | 76.9 |
| Llama-3.3-70B | 65.7 | 63.8 | 61.1 | 59.9 | 63.0 |

On the strongest reasoning models the gap is 0–4 points. The paper's GPT-4o row prints English 59.9, below Czech 70.1. That is an anomaly in the source, so do not draw conclusions from it.

EuroLLM-9B report, [arXiv:2506.04079](https://arxiv.org/abs/2506.04079), Tables 15 and 35. It compares machine-translated Polish benchmarks with the English originals:

- MMLU, EN vs PL: Gemma-2-9B-IT 71.9 vs 65.1, Llama-3.1-8B-IT 68.3 vs 57.7, Qwen-2.5-7B-IT 73.4 vs 63.9.
- On TruthfulQA, Polish is often higher, e.g. Llama-3.1-8B-IT 53.0 vs 58.1.
- These gaps mix the effect of language with the effect of translation.

### 2.6 Reasoning language, instruction language and agents

| Finding | Numbers | Source |
|---|---|---|
| Forcing the model to *think* in the user's language costs accuracy | AIME, 11-language average: R1-Distill-Qwen-14B 27.2 → 14.4; Skywork-OR1-32B 44.8 → 29.6 | Qi et al., [arXiv:2505.22888](https://arxiv.org/abs/2505.22888), Findings EMNLP 2025, Table 1 |
| Telling the model to use English (vs no language control) gives the best average across 18 languages (incl. Russian) | QwQ-32B 45.9 → 47.9; forcing the query language: 43.4, the worst option for all three models | PolyMath, [arXiv:2504.18428](https://arxiv.org/abs/2504.18428), Table 7 |
| Prefilling the reasoning in English helps; the effect is biggest for low-resource languages | MATH-500 gain: Swahili +31.5, Japanese +18.5, Spanish +15.5, Russian +5.1, Chinese +1.9 | [arXiv:2505.17407](https://arxiv.org/abs/2505.17407), Table 1 |
| Agents are weaker and less safe outside English | GAIA: English 47.4 vs non-English average 35.8. Agent Security Benchmark attack success: 32.7 EN vs 47.3 non-EN | MAPS, [arXiv:2505.15935](https://arxiv.org/abs/2505.15935) |
| Translating only the **instructions** into a Slavic language can break some models | Czech content: English instructions vs Czech instructions. Claude 3.7 94.5 → 70.2; Mistral Large 94.5 → 41.0; Gemini 92.3 → 81.6; GPT-4o 96.9 → 96.6. Ukrainian: Claude 92.9 → 56.6 | [arXiv:2504.17720](https://arxiv.org/abs/2504.17720), Table 3 |
| Models internally route through English | 50–70% of key lexical decisions pass through English-like representations | Schut, Gal, Farquhar, [arXiv:2502.15603](https://arxiv.org/abs/2502.15603) |

### 2.7 Cost: tokenization

| Language | Tokens per word (mean over 6 tokenizers incl. GPT-4o, Llama, Qwen3, DeepSeek V3) |
|---|---|
| English | 1.23 |
| German | 1.76 |
| **Polish** | **2.25** (min–max over models: 1.88–2.60) |
| Czech | 2.28 |
| Slovak | 2.45 |
| Ukrainian | 2.66 |

Source: Ovcharov, "The Tokenizer Tax…", [arXiv:2605.24718](https://arxiv.org/abs/2605.24718), May 2026, Table 4. This is a single-author preprint.

The same text, the Polish Constitution preamble, in Polish vs English (Bielik v3 tokenizer report, [arXiv:2604.10799](https://arxiv.org/abs/2604.10799), Table 1):

| Tokenizer | PL tokens | EN tokens | PL / EN |
|---|---|---|---|
| Llama 3.2 | 653 | 371 | 1.76× |
| Qwen3 | 625 | 373 | 1.68× |
| Mistral Small 3.1 / Apertus | 547 | 377 | 1.45× |
| Gemma 3 | 510 | 383 | 1.33× |
| EuroLLM | 437 | 404 | 1.08× |
| APT4 (Polish tokenizer) | 375 | 631 | 0.59× |

## 3. Answer to the research question

| Question | Answer | Strength of evidence |
|---|---|---|
| Is Polish better than English for prompting in general? | **No.** The only result favouring Polish is a long-context retrieval benchmark on early-2025 models, with no significance test. | High |
| Retrieval / RAG | English is better. On MKQA RAG English beats Polish by 8–22 points (small open models), and RAG pipelines prefer English evidence. No frontier-model study compares Polish and English RAG on the same documents. | Medium |
| Knowledge / reasoning | English is better for most models. For frontier models the gap is about 0–3 points and sometimes reversed. | High |
| Agents / multi-turn | English is best on average. Polish is 2–3 points behind on frontier models (EU-24+, 2026). | Medium-high (one 2026 study) |
| Does language affect the level of reasoning? | **Yes, mainly through the language of instructions and of the model's thinking.** Non-English thinking and translated instructions lower accuracy. The language of the data matters less for strong models. | High |

### Practical recommendations for developers working in Polish

1. **Write system prompts, tool descriptions and agent instructions in English.** Keep Polish data, documents and user messages in Polish, and ask for the final answer in Polish if users need it.
2. **Let reasoning models think in English.** Do not force the chain of thought into Polish.
3. **For RAG over Polish documents, do not translate the corpus.** Use embedding models tested on Polish (PL-MTEB leaderboard) and evaluate on your own Polish questions.
4. **Plan for about 1.3–1.8× more tokens in Polish** (depending on the model's tokenizer), for both cost and context-window size.
5. **Small or open models:** expect a 5–20 point loss in Polish. Test a Polish model (Bielik, PLLuM) against a frontier model on your own task before choosing.
6. **Measure on your own evaluation set.** Benchmark differences of 1–3 points are smaller than the variation between tasks.

## 4. Method and verification

- **Team.** 15 research agents (Claude Haiku) worked under a coordinator (Claude Opus).
  - Six initial scopes: original source, reasoning, retrieval/RAG, native Slavic sources, prompt language and agents, critiques.
  - Second iteration: Polish reasoning, retrieval/RAG, and native-language search in Czech, Slovak, Ukrainian, Russian, Bulgarian, Croatian, Serbian and Slovenian.
  - Iterations 3–5: Polish RAG and long context, including Polish-language sources and parallel benchmarks.
  - Five separate verification agents re-checked the claims.
- **Coordinator checks.** The coordinator read every number in this report directly from the paper's arXiv HTML table (DOM extraction) or quoted sentence. Raw CSV extracts are in `data/`.
- **Rules.** Only primary sources count as evidence: papers, technical reports and official tables. Press and social media were used only to find sources.
- **Errors caught by verification:**
  - A misreported "removing the none option" claim. The paper says *adding* it lowers accuracy.
  - A misread of the Czech education study. The 94.5 → 41.0 drop is from translating the *instructions*, not the content.
  - A claim about Russian/English deltas in MERA Code that was not confirmed.
  - Search-snippet numbers that could not be found in the papers.
- **Remaining gaps.**
  - No same-document Polish vs English RAG study with 2025–2026 models.
  - Global-MMLU per-model Polish rows not extracted.
  - OneRuler per-language values for all 26 languages exist only as heatmap images.
  - The COLM 2025 venue is confirmed only by secondary sources.

## Sources (primary)

1. Kim et al. 2025, OneRuler, arXiv:2503.01996
2. Hakimov et al. 2026, Language Equality has a Price (EU-24+), arXiv:2608.01395
3. Grzybowski et al. 2025, Polish-English medical knowledge transfer, arXiv:2412.00559 (Findings EMNLP 2025)
4. Lasik et al. 2026, Reassessing High-Performing LLMs on Polish Medical Exams, arXiv:2606.12250
5. Kołos et al. 2026, PoVisLE, arXiv:2608.07763
6. MultiWikiQA 2025, arXiv:2509.04111
7. Linguistic Nepotism 2025, arXiv:2509.13930
8. MMLU-ProX 2025, arXiv:2503.10497
9. EuroLLM-9B technical report 2025, arXiv:2506.04079
10. Qi et al. 2025, When Models Reason in Your Language, arXiv:2505.22888
11. PolyMath 2025, arXiv:2504.18428
12. Language Matters (multilingual reasoning paths) 2025, arXiv:2505.17407
13. MAPS multilingual agent benchmark 2025, arXiv:2505.15935
14. Multilingual performance biases of LLMs in education 2025, arXiv:2504.17720
15. Schut, Gal, Farquhar 2025, Do multilingual LLMs think in English?, arXiv:2502.15603
16. Ovcharov 2026, The Tokenizer Tax, arXiv:2605.24718
17. Bielik v3 tokenizer report 2026, arXiv:2604.10799 (and Bielik 7B v0.1, arXiv:2410.18565)
18. BgGPT 1.0 (Bulgarian vs English, same models), arXiv:2412.10893
19. On the Consistency of Multilingual Context Utilization in RAG (MKQA), arXiv:2504.00597

Press (pointers only):

- Science in Poland, 27 Nov 2025: https://scienceinpoland.pl/en/news/news,110407,polish-language-not-superior-ai-prompting-researchers-say.html
- Spider's Web, 27 Oct 2025: https://spidersweb.pl/2025/10/polski-jezyk-najlepszy-dla-ai.html
- Spider's Web, 12 Nov 2025: https://spidersweb.pl/2025/11/polski-jezyk-ai-microsoft-dementuje-oneruler.html
