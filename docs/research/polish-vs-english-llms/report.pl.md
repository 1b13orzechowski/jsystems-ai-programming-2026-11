# Czy język polski jest lepszy od angielskiego do promptowania LLM?

Raport badawczy, 24 listopada 2026. Przygotowany na kurs JSystems „AI dla programistów”.

## W skrócie

- **Źródło.** Doniesienia z 2025 roku, że „polski to najlepszy język do promptowania AI”, wywodzą się z jednej pracy: **OneRuler**.
  - Autorzy: Kim, Russell, Karpińska, Iyyer (University of Maryland, Microsoft, UMass Amherst).
  - Tytuł: *„One ruler to measure them all: Benchmarking multilingual long-context language models”*, [arXiv:2503.01996](https://arxiv.org/abs/2503.01996).
  - Wersja v3 z 30.09.2025. Według prasy i źródeł wtórnych praca trafiła na COLM 2025.
- **Co zmierzono.** Badanie mierzyło wyszukiwanie faktów w bardzo długim tekście (tzw. igła w stogu siana, 64K–128K tokenów), a nie jakość promptowania, rozumowanie ani pracę agentów.
  - Polski miał tam najwyższą średnią skuteczność (88%), angielski był 6. z 26 języków (83,9%).
  - Testowano modele z początku 2025 roku.
  - Każdy język miał inną książkę jako „stóg siana”.
  - Współautorka, Marzena Karpińska: na podstawie tego badania „na pewno nie możemy stwierdzić, że polski jest najlepszym językiem do promptowania” (Nauka w Polsce / Science in Poland, 27.11.2025).
- **Nowsze dane (2025–2026) nie potwierdzają tezy „polski > angielski”.**
  - W wyszukiwaniu, RAG, wiedzy, rozumowaniu i zadaniach wieloturowych (agentowych) angielski jest zwykle równy lub lepszy przy tym samym modelu.
  - Przy najmocniejszych modelach 2026 (GPT-5.4, Claude Opus 4.8, Claude Sonnet 5, Qwen3.5) różnica między polskim lub innymi językami słowiańskimi a angielskim jest mała, zwykle 0–3 pkt, czasem na korzyść języka słowiańskiego.
  - Przy mniejszych i otwartych modelach angielski wygrywa o 5–20 pkt.
- **Czy język wpływa na rozumowanie agenta?** Tak, ale ważniejszy jest język *instrukcji* i *myślenia modelu* niż język *treści*.
  - Wymuszenie myślenia w języku innym niż angielski obniża skuteczność.
  - Samo przetłumaczenie instrukcji na czeski lub ukraiński powodowało załamanie części modeli (Mistral Large: 94,5% → 41,0%).
  - Ta sama czeska treść z instrukcją po angielsku dawała wynik bliski angielskiemu.
- **Polski jest droższy w tokenach.** Ten sam tekst po polsku zajmuje **około 1,3–1,8× więcej tokenów** niż po angielsku w popularnych tokenizerach (Gemma 3 1,33×, Qwen3 1,68×, Llama 3.2 1,76×). Na jedno słowo przypada średnio 2,25 tokena po polsku i 1,23 po angielsku. To podnosi koszt API i szybciej zapełnia okno kontekstu.

## 1. Oryginalne źródło i co naprawdę mówi

| Element | Wartość | Gdzie (sprawdzone w źródle) |
|---|---|---|
| Praca | Kim, Russell, Karpińska, Iyyer, „One ruler to measure them all…”, arXiv 2503.01996 v3 (30.09.2025) | arXiv HTML v3, strona tytułowa |
| Benchmark | 26 języków, 7 modeli, kontekst 8K / 32K / 64K / 128K; zadania: wyszukiwanie jednej lub wielu „igieł” (NIAH) i wypisywanie najczęstszych słów (CWE) | Rozdz. 2–3 |
| Modele | Gemini 1.5 Flash, o3-mini-high, Qwen2.5 7B/72B, Llama 3.1 8B, Llama 3.3 70B (+ DeepSeek-R1 tylko w analizie dla angielskiego) | Rozdz. 3 |
| Główny wynik | „przy długości kontekstu 64K i 128K … polski jest najlepszy w zadaniach NIAH ze średnią skutecznością 88% dla wszystkich modeli” | Rozdz. 3.1 |
| Angielski | „dopiero 6. z 26 języków, średnio 83,9%” | Rozdz. 3.1 |
| Chiński | 4. od końca, 62,1% | Rozdz. 3.1 |
| o3-mini-high, 128K | angielski 67%, polski 92%, ukraiński 89% | Rozdz. 3.1 |
| Opcja „brak odpowiedzi” | Dodanie zdania „jeśli takiej liczby nie ma, odpowiedz none” obniża S-NIAH o 32% przy 128K (angielski) | Rozdz. 2 / rys. 1b |
| Język instrukcji | Kontekst po angielsku, instrukcje po koreańsku: 91% → 71% przy 64K. Kontekst po koreańsku, instrukcje zmienione na angielskie: 61% → 77% przy 128K | Rozdz. 4 |
| Po wyrównaniu ilości treści | „języki słowiańskie (rosyjski, ukraiński, polski) wypadają wysoko … angielski jest jeszcze niżej, zwykle 8.” | Aneks D |
| Inna książka dla każdego języka | EN *Małe kobietki* (234 tys. tokenów), PL *Noce i dnie* t. 3 (453 tys.), RU *Wojna i pokój* (1,1 mln), CS *Szwejk* t. 3 (175 tys.) | Tabela 4 |

**Ograniczenia badania:**

1. Zadanie jest syntetyczne: chodzi o znalezienie liczby wstawionej w powieść. To nie jest test promptowania, rozumowania ani pracy agentów.
2. Każdy język ma inną książkę, więc trudność „stogu siana” nie jest kontrolowana.
3. Modele pochodzą z początku 2025 roku.
4. Praca nie zawiera testu istotności statystycznej dla różnicy PL–EN. Prasa cytuje współautorkę, że różnica nie była istotna, ale to parafraza dziennikarza, a nie zapis w pracy.
5. Autorzy nie podają jednej przyczyny wyniku. Pierwszą dziesiątkę tworzą języki słowiańskie, romańskie i germańskie, które mają dużą Wikipedię i alfabet łaciński. Rosyjski i ukraiński używają jednak cyrylicy.

**Jak to opisały media.** Spider's Web (27.10.2025) zatytułował tekst „Polski najlepszym językiem dla botów”, a Polskie Radio pisało, że chatboty lepiej rozumieją polskie instrukcje. Obie relacje wychodzą poza to, co mierzyła praca. Sprostowanie z cytatami współautorki opublikowała Nauka w Polsce (PAP, 27.11.2025). Spider's Web (12.11.2025) pisze, że Microsoft „dementuje” doniesienia, ale nie cytuje żadnego rzecznika Microsoftu.

## 2. Nowsze dowody według obszarów

Wszystkie liczby poniżej koordynator odczytał ponownie z tabel HTML danej pracy. Przy każdej podano numer tabeli.

### 2.1 Zadania wieloturowe, zbliżone do agentowych: EU-24+ (2026)

Źródło: Hakimov i in., *„Language Equality has a Price: A Systematic Investigation of Multi-turn LLM Performance for EU-24+”*, [arXiv:2608.01395](https://arxiv.org/abs/2608.01395), sierpień 2026, tabela 4. Benchmark to 14 interaktywnych gier dialogowych w 30 językach, ocenianych automatycznie (clemscore).

| Model | EN | PL | CS | SK | UK | RU | HR | BG |
|---|---|---|---|---|---|---|---|---|
| GPT-5.4 | 91,8 | 89,5 | 90,6 | 90,3 | **93,0** | 89,3 | **93,0** | **92,4** |
| Claude Opus 4.8 | 84,4 | 82,3 | 81,7 | 82,1 | 79,6 | 80,1 | 83,7 | 80,6 |
| GLM-5.2 | 65,6 | 64,3 | 60,1 | 59,4 | **67,0** | 62,3 | 64,2 | **68,9** |
| DeepSeek-V4 | 64,8 | 62,5 | 58,6 | 59,3 | 55,7 | 62,5 | 56,4 | 61,2 |
| Gemma 4 | 50,6 | **59,7** | **52,8** | **53,6** | **56,7** | **58,0** | **55,2** | **60,8** |
| Qwen3.6 | 55,6 | 45,9 | 50,4 | 48,6 | 50,0 | 53,8 | 46,0 | 52,4 |
| **Średnia z 9 modeli** | **61,9** | 59,2 | 56,2 | 54,5 | 57,8 | 59,4 | 56,9 | 58,7 |

Pogrubione wartości są wyższe niż angielski dla danego modelu.

- Angielski ma najwyższą średnią spośród 30 języków. Polski jest 7., za chińskim, niderlandzkim, niemieckim, rosyjskim i szwedzkim.
- Przy modelach z czołówki polski traci około 2 pkt.
- Jeden otwarty model, Gemma 4, wypada lepiej po polsku niż po angielsku.

### 2.2 Wiedza i rozumowanie na równoległych egzaminach: polskie egzaminy lekarskie

Źródło: Grzybowski, Pokrywka, Ciesiółka, Kaczmarek, Kubis, *„Polish-English medical knowledge transfer: A new benchmark and results”*, [arXiv:2412.00559](https://arxiv.org/abs/2412.00559), Findings of EMNLP 2025, tabela 4. Wersje angielskie to oficjalne tłumaczenia CEM, więc pytania są te same.

| Model | LEK PL | LEK EN | Δ (PL−EN) |
|---|---|---|---|
| GPT-4o (2024-08) | 89,96 | 88,69 | **+1,27** |
| Llama-3.1-70B-Instruct | 80,94 | 82,60 | −1,66 |
| Qwen2.5-72B-Instruct | 76,87 | 81,93 | −5,06 |
| Mistral-Large-2407 | 76,75 | 82,40 | −5,65 |
| Bielik-11B-v2.2 (model polski) | 62,36 | 56,98 | **+5,38** |
| Qwen2.5-7B-Instruct | 51,92 | 67,73 | −15,81 |
| Llama-3.1-8B-Instruct | 51,25 | 64,69 | −13,44 |

- Angielski wygrywa w 12 z 16 testowanych modeli. Autorzy piszą, że modele „radzą sobie istotnie lepiej z pytaniami po angielsku”, a różnica „maleje” wraz z jakością modelu.
- Polski wygrywa tylko przy GPT-4o, polskim modelu Bielik i Meditron3-70B. gpt-4o-mini daje remis.

### 2.3 Treści polskie przetłumaczone na angielski: PoVisLE (2026)

Źródło: Kołos i in., *„Jako Tako or Fluent? Presenting PoVisLE: A Polish Vision-Language Evaluation”*, [arXiv:2608.07763](https://arxiv.org/abs/2608.07763), sierpień 2026, tabela 14. To pytania o polską kulturę i język z obrazami, przetłumaczone na angielski i niemiecki.

| Model | PL | EN (tłum.) | Δ EN−PL |
|---|---|---|---|
| Qwen3.5-397B (Thinking) | 75,16 | 68,12 | −7,04 |
| Claude Sonnet 5 | 69,94 | 66,94 | −3,00 |
| GPT-5.4 | 68,35 | 70,40 | +2,06 |
| Gemma-4-31B (Thinking) | 72,51 | 72,02 | −0,48 |
| Qwen3.5-9B | 38,75 | 47,04 | +8,29 |

- Polski wygrywa w 8 z 16 modeli, angielski również w 8.
- Przy treściach z natury polskich tłumaczenie na angielski odbiera najmocniejszym modelom kontekst kulturowy. Małe modele nadal zyskują na angielskim.

### 2.4 Wyszukiwanie i RAG

| Dowód | Wynik | Źródło |
|---|---|---|
| Czytanie ze zrozumieniem na Wikipedii każdego języka (treści nierównoległe) | F1 EN vs PL: Mistral-Small-3.1-24B Instruct 78,5 vs 64,7; Llama-3.1-8B Instruct 71,4 vs 55,8. Czeski i słowacki są o około 5–10 pkt wyżej od polskiego | MultiWikiQA, [arXiv:2509.04111](https://arxiv.org/abs/2509.04111), tabele 4–6 |
| Trafność cytowania źródeł w wielojęzycznym RAG | Modele preferują dowody po angielsku. Rosyjski wypada niżej we wszystkich 6 modelach, o 5,3–12,2 pkt, wszystkie różnice istotne (np. Llama-3.3-70B: 85,9 EN vs 74,5 RU). Polski nie był testowany | „Linguistic Nepotism”, [arXiv:2509.13930](https://arxiv.org/abs/2509.13930), tabela 1 |
| **RAG ze złotym fragmentem w języku pytania (MKQA, pytania równoległe)** | Skuteczność EN vs PL: Aya-Expanse-8B 87,5 vs 79,2; Gemma-2-9B 79,8 vs 67,8; Qwen2.5-7B 86,0 vs 68,9; Llama-3.2-3B 82,4 vs 60,6. Angielski wygrywa o 8–22 pkt. Metryka to ścisłe dopasowanie leksykalne, które może karać odmienione polskie odpowiedzi | [arXiv:2504.00597](https://arxiv.org/abs/2504.00597) v4, tabela 15 |
| Polskie benchmarki wyszukiwania i embeddingów (PL-MTEB, PIRB, polski RAG na LREC 2026) | Tylko po polsku, bez wersji angielskiej | zob. źródła |

Badanie MKQA (2025, małe otwarte modele) to jedyne znalezione porównanie RAG PL vs EN dla tych samych modeli. Nie znaleźliśmy **żadnego badania z lat 2025–2026, które porównywałoby RAG na tych samych dokumentach po polsku i po angielsku z modelami z czołówki**. Luka pozostała po pięciu iteracjach wyszukiwania (zob. rozdz. 4).

### 2.5 Wiedza i rozumowanie w innych językach słowiańskich

Źródło: MMLU-ProX, [arXiv:2503.10497](https://arxiv.org/abs/2503.10497), tabela 3. Obejmuje 29 języków, bez polskiego.

| Model | EN | CS | RU | UK | SR |
|---|---|---|---|---|---|
| Qwen3-235B (Thinking) | 80,7 | 80,5 | 77,0 | 78,8 | 80,2 |
| DeepSeek-R1 | 79,5 | 76,8 | 76,4 | 76,8 | **80,9** |
| GPT-4.1 | 79,8 | 77,5 | 71,2 | 76,4 | 76,9 |
| Llama-3.3-70B | 65,7 | 63,8 | 61,1 | 59,9 | 63,0 |

Przy najmocniejszych modelach rozumujących różnica wynosi 0–4 pkt. W wierszu GPT-4o praca podaje dla angielskiego 59,9, czyli mniej niż dla czeskiego (70,1). To anomalia w samym źródle, więc nie należy z niej wyciągać wniosków.

Raport EuroLLM-9B, [arXiv:2506.04079](https://arxiv.org/abs/2506.04079), tabele 15 i 35. Porównuje maszynowo przetłumaczone polskie benchmarki z angielskimi oryginałami:

- MMLU, EN vs PL: Gemma-2-9B-IT 71,9 vs 65,1, Llama-3.1-8B-IT 68,3 vs 57,7, Qwen-2.5-7B-IT 73,4 vs 63,9.
- W TruthfulQA polski często wypada lepiej, np. Llama-3.1-8B-IT 53,0 vs 58,1.
- Te różnice mieszają wpływ języka z wpływem tłumaczenia.

### 2.6 Język rozumowania, język instrukcji i agenci

| Ustalenie | Liczby | Źródło |
|---|---|---|
| Wymuszenie *myślenia* w języku użytkownika obniża skuteczność | AIME, średnia z 11 języków: R1-Distill-Qwen-14B 27,2 → 14,4; Skywork-OR1-32B 44,8 → 29,6 | Qi i in., [arXiv:2505.22888](https://arxiv.org/abs/2505.22888), Findings EMNLP 2025, tabela 1 |
| Polecenie użycia angielskiego (zamiast braku wskazania języka) daje najlepszą średnią z 18 języków (w tym rosyjskiego) | QwQ-32B 45,9 → 47,9; wymuszenie języka pytania: 43,4, najgorsza opcja we wszystkich 3 modelach | PolyMath, [arXiv:2504.18428](https://arxiv.org/abs/2504.18428), tabela 7 |
| Rozpoczęcie rozumowania po angielsku pomaga, najbardziej w językach o małych zasobach | Zysk na MATH-500: suahili +31,5, japoński +18,5, hiszpański +15,5, rosyjski +5,1, chiński +1,9 | [arXiv:2505.17407](https://arxiv.org/abs/2505.17407), tabela 1 |
| Agenci są słabsi i mniej bezpieczni poza angielskim | GAIA: angielski 47,4 vs średnia innych języków 35,8. Skuteczność ataków w Agent Security Benchmark: 32,7 EN vs 47,3 poza EN | MAPS, [arXiv:2505.15935](https://arxiv.org/abs/2505.15935) |
| Samo przetłumaczenie **instrukcji** na język słowiański potrafi „zepsuć” część modeli | Treść po czesku: instrukcja EN vs instrukcja CS. Claude 3.7 94,5 → 70,2; Mistral Large 94,5 → 41,0; Gemini 92,3 → 81,6; GPT-4o 96,9 → 96,6. Ukraiński: Claude 92,9 → 56,6 | [arXiv:2504.17720](https://arxiv.org/abs/2504.17720), tabela 3 |
| Modele „przechodzą” wewnętrznie przez angielski | 50–70% kluczowych decyzji leksykalnych zapada w reprezentacjach zbliżonych do angielskich | Schut, Gal, Farquhar, [arXiv:2502.15603](https://arxiv.org/abs/2502.15603) |

### 2.7 Koszt: tokenizacja

| Język | Tokeny na słowo (średnia z 6 tokenizerów, m.in. GPT-4o, Llama, Qwen3, DeepSeek V3) |
|---|---|
| angielski | 1,23 |
| niemiecki | 1,76 |
| **polski** | **2,25** (rozrzut między modelami 1,88–2,60) |
| czeski | 2,28 |
| słowacki | 2,45 |
| ukraiński | 2,66 |

Źródło: Ovcharov, „The Tokenizer Tax…”, [arXiv:2605.24718](https://arxiv.org/abs/2605.24718), maj 2026, tabela 4. To preprint jednego autora.

Ten sam tekst, preambuła Konstytucji RP, po polsku i po angielsku (raport tokenizera Bielik v3, [arXiv:2604.10799](https://arxiv.org/abs/2604.10799), tabela 1):

| Tokenizer | Tokeny PL | Tokeny EN | PL / EN |
|---|---|---|---|
| Llama 3.2 | 653 | 371 | 1,76× |
| Qwen3 | 625 | 373 | 1,68× |
| Mistral Small 3.1 / Apertus | 547 | 377 | 1,45× |
| Gemma 3 | 510 | 383 | 1,33× |
| EuroLLM | 437 | 404 | 1,08× |
| APT4 (polski tokenizer) | 375 | 631 | 0,59× |

## 3. Odpowiedź na pytanie badawcze

| Pytanie | Odpowiedź | Siła dowodów |
|---|---|---|
| Czy polski jest ogólnie lepszy do promptowania niż angielski? | **Nie.** Jedyny wynik na korzyść polskiego pochodzi z benchmarku wyszukiwania w długim kontekście, na modelach z początku 2025, bez testu istotności. | Wysoka |
| Wyszukiwanie / RAG | Angielski jest lepszy. W RAG na MKQA wygrywa z polskim o 8–22 pkt (małe otwarte modele), a systemy RAG preferują źródła po angielsku. Brak badania PL vs EN na tych samych dokumentach z modelami z czołówki. | Średnia |
| Wiedza / rozumowanie | Angielski wygrywa w większości modeli. Przy czołowych modelach różnica wynosi około 0–3 pkt, czasem odwrotnie. | Wysoka |
| Agenci / zadania wieloturowe | Angielski ma najlepszą średnią. Polski traci 2–3 pkt przy czołowych modelach (EU-24+, 2026). | Średnio-wysoka (jedno badanie z 2026) |
| Czy język wpływa na poziom rozumowania? | **Tak, głównie przez język instrukcji i język myślenia modelu.** Myślenie poza angielskim i tłumaczone instrukcje obniżają skuteczność. Język danych ma przy mocnych modelach mniejsze znaczenie. | Wysoka |

### Praktyczne rekomendacje dla programistów pracujących po polsku

1. **Prompty systemowe, opisy narzędzi i instrukcje dla agentów pisz po angielsku.** Dane, dokumenty i wiadomości użytkowników zostaw po polsku. Jeśli użytkownik potrzebuje, poproś o odpowiedź końcową po polsku.
2. **Pozwól modelom rozumującym myśleć po angielsku.** Nie wymuszaj polskiego toku rozumowania.
3. **W RAG na polskich dokumentach nie tłumacz korpusu.** Użyj embeddingów testowanych na polskim (ranking PL-MTEB) i oceniaj jakość na własnych polskich pytaniach.
4. **Zakładaj około 1,3–1,8× więcej tokenów po polsku** (zależnie od tokenizera modelu), zarówno w kosztach, jak i w rozmiarze okna kontekstu.
5. **Małe i otwarte modele:** spodziewaj się straty 5–20 pkt po polsku. Zanim wybierzesz, porównaj model polski (Bielik, PLLuM) z modelem czołowym na własnym zadaniu.
6. **Mierz na własnym zestawie testowym.** Różnice 1–3 pkt w benchmarkach są mniejsze niż rozrzut między zadaniami.

## 4. Metoda i weryfikacja

- **Zespół.** Pracowało 15 agentów badawczych (Claude Haiku) pod nadzorem koordynatora (Claude Opus).
  - Sześć obszarów na start: źródło, rozumowanie, wyszukiwanie/RAG, źródła słowiańskie w językach narodowych, język promptu i agenci, krytyka.
  - 2. iteracja: polskie rozumowanie, wyszukiwanie i RAG oraz wyszukiwanie po czesku, słowacku, ukraińsku, rosyjsku, bułgarsku, chorwacku, serbsku i słoweńsku.
  - Iteracje 3–5: polski RAG i długi kontekst, w tym źródła polskojęzyczne i benchmarki równoległe.
  - Pięciu osobnych agentów weryfikowało twierdzenia.
- **Kontrola koordynatora.** Każdą liczbę z tego raportu koordynator odczytał bezpośrednio z tabeli HTML pracy na arXiv (ekstrakcja z DOM) albo z cytowanego zdania. Surowe dane CSV są w `data/`.
- **Zasady.** Dowodem są tylko źródła pierwotne: prace, raporty techniczne i oficjalne tabele. Prasę i media społecznościowe używaliśmy wyłącznie do odnalezienia źródeł.
- **Błędy wyłapane podczas weryfikacji:**
  - Błędne „usunięcie opcji none”. W pracy jest *dodanie* tej opcji, które obniża wynik.
  - Błędna interpretacja badania czeskiego. Spadek 94,5 → 41,0 dotyczy tłumaczenia *instrukcji*, nie treści.
  - Niepotwierdzone twierdzenie o różnicach RU/EN w MERA Code.
  - Liczby z fragmentów wyników wyszukiwania, których nie dało się znaleźć w pracach.
- **Pozostałe luki.**
  - Brak badania RAG PL vs EN na tych samych dokumentach z modelami z lat 2025–2026.
  - Nie wyodrębniono wierszy dla polskiego z Global-MMLU dla poszczególnych modeli.
  - Wartości OneRuler dla wszystkich 26 języków są dostępne tylko jako mapy cieplne (obrazy).
  - Konferencję COLM 2025 potwierdzają tylko źródła wtórne.

## Źródła (pierwotne)

Pełna lista z identyfikatorami arXiv jest w [report.en.md](report.en.md#sources-primary) (pozycje 1–19).

Prasa (tylko jako drogowskazy):

- Nauka w Polsce / Science in Poland, 27.11.2025: https://scienceinpoland.pl/en/news/news,110407,polish-language-not-superior-ai-prompting-researchers-say.html
- Spider's Web, 27.10.2025: https://spidersweb.pl/2025/10/polski-jezyk-najlepszy-dla-ai.html
- Spider's Web, 12.11.2025: https://spidersweb.pl/2025/11/polski-jezyk-ai-microsoft-dementuje-oneruler.html
