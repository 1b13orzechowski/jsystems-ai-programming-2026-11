# COURSE-NAME (COURSE-ORGANIZER)

**Materiały szkoleniowe: [devpowers.com/szkolenia/COURSE-SITE](https://devpowers.com/szkolenia/COURSE-SITE/)**

- [Zakres i wszystkie materiały](https://devpowers.com/szkolenia/COURSE-SITE/index.html#prezentacje)
- [Slajdy](https://devpowers.com/szkolenia/COURSE-SITE/index.html#prezentacje)
- [Biblioteka promptów](https://devpowers.com/szkolenia/COURSE-SITE/prompty.html) · [Ćwiczenia](https://devpowers.com/szkolenia/COURSE-SITE/cwiczenia.html) · [Checklisty](https://devpowers.com/szkolenia/COURSE-SITE/checklisty.html) · [Słownik AI](https://devpowers.com/szkolenia/COURSE-SITE/slownik-ai.html)
- [Wyniki ankiety przed szkoleniem](https://devpowers.com/szkolenia/COURSE-SITE/raport-przed.html) · [Odpowiedzi na pytania z kursu](https://devpowers.com/szkolenia/COURSE-SITE/pytania.html) (uzupełniamy po każdym dniu)


Repozytorium uczestnika szkolenia COURSE-ORGANIZER (COURSE-DATES, online, COURSE-HOURS). Przerwy w godzinach COURSE-BREAKS. W czasie szkolenia (COURSE-DURATION) przechodzimy pełny cykl wytwarzania oprogramowania z agentami AI: od pomysłu i wymagań (PRD), przez decyzje architektoniczne (ADR), plan, implementację i testy, po code review, bezpieczeństwo i CI/CD.

Głównym agentem warsztatu jest **OpenAI Codex CLI**, a te same koncepcje pokazujemy także w **Claude Code** i **GitHub Copilot**. Możesz pracować w swoim stosie (np. C# / .NET, Java, Python); przykład prowadzącego powstaje w TypeScript.

Głównym projektem grupy jest aplikacja do obsługi zwrotów i reklamacji elektroniki, rozwijana według PRD uzgodnionego podczas zajęć. Możesz też pracować nad własnym pomysłem, stosując ten sam proces. Po PRD omów architekturę i biblioteki, zapisz decyzje w ADR, ułóż plan i zależności zadań, a potem implementuj, testuj i przeglądaj zmiany przed utworzeniem PR. Przykładowy prompt PRD w `course-materials/` nie zastępuje dokumentu poprawionego z grupą.

## Start na Windows

Utwórz [własny fork na GitHubie](https://github.com/COURSE-REPO-OWNER/COURSE-REPO/fork). W swoim forku kliknij **Code**, wybierz **HTTPS** i skopiuj adres. Jeśli kurs nie korzysta z forków, użyj adresu repozytorium kursu. Otwórz PowerShell w katalogu, w którym chcesz trzymać projekt, i wykonuj kolejno po jednym poleceniu:

```powershell
$forkUrl = Read-Host "Wklej adres HTTPS swojego forka"
```

```powershell
git clone $forkUrl COURSE-REPO
```

```powershell
Set-Location COURSE-REPO
```

```powershell
git switch -c feat/moja-aplikacja
```

```powershell
codex
```

Każde polecenie jest w osobnym bloku, bo Windows PowerShell 5.1 nie obsługuje `&&`, a długie polecenia łatwo uszkodzić przy wklejaniu. Codex uruchamiasz w katalogu głównym repozytorium. Przejrzyj komunikat zaufania do projektu i zaakceptuj przygotowane repozytorium. Wspólne ustawienia są w `.codex/config.toml`; domyślny profil `course-tools` pozwala edytować projekt i korzystać z sieci, w tym instalować zależności. Zarządzana polityka maszyny może dodatkowo ograniczać dostęp. Zanim dodasz prawdziwy klucz API, przeczytaj sekcję [Granice](#granice).

## Biblioteka dodatkowa

`course-materials/` zawiera szeroką bibliotekę pełnych promptów, danych syntetycznych, checklist, przykładów konfiguracji i materiałów o innych agentach. To zasób do późniejszego czytania, nie lista narzędzi wymaganych na warsztacie. [Pełne prompty historyczne](course-materials/Prompt%20examples/) zachowano bez skracania; starsze twierdzenia o produktach, licencjach i komendach wymagają ponownego sprawdzenia. Podczas pracy z wybraną aplikacją agent nie powinien sam przeszukiwać `course-materials/`: zawarte tam PRD, ADR i instrukcje są przykładami, a nie wymaganiami tego projektu. Otwórz konkretny materiał dopiero wtedy, gdy go o to poprosisz.

W bibliotece znajdują się również **archiwalne materiały z wcześniejszego kursu o Claude Code**: [notatki](course-materials/Course%20INDEX%20-%20AI%20in%20Programming.md), [quiz](course-materials/quizzes/day-1-anonymous-ai-basics-quiz.md), [przykłady konfiguracji](course-materials/agent-configs/claude/) i [słownik PDF](course-materials/AI%20dla%20Programist%C3%B3w%20-%20S%C5%82ownik%20przed%20szkoleniem.pdf). Zachowano je jako źródła do ponownego wykorzystania, **nie jako aktualną konfigurację tego warsztatu**. Przykłady ustawień i skrypty należy dostosować i sprawdzić przed użyciem.

Wybierz materiał do zadania:

- **Prompty i planowanie:** [PRD](course-materials/Prompt%20examples/PRD-electronics-returns-complains-app.md), [ADR](course-materials/Prompt%20examples/ADR-generation-typescript-vercel-ai-sdk.md), [plan implementacji](course-materials/Prompt%20examples/Plan-SubAgents-matrix-dependency-map.md), [propozycja skilla planowania](https://github.com/EdukeyTeam/agent-toolbox/pull/28) (otwarty PR).
- **Konfiguracje agentów:** [ustawienia, uprawnienia, profile i skróty Bash/PowerShell](course-materials/agent-configs/).
- **Codex na Windows:** [konfiguracja i test działania](course-materials/agent-configs/codex/WINDOWS-QUICKSTART-PL.md), [regresje sandboxa i formularzy pytań](course-materials/Research/codex-sandbox-facts-and-limitations-2026-11-06.md). Po zmianie konfiguracji zrestartuj daemon i zacznij nową sesję, zamiast wznawiać poprzednią.
- **Hooki i zgody:** [ochrona plików i przykłady hooków](course-materials/hooks-example/), [Context7](course-materials/hooks-example/context7/), [permissions a hooki](course-materials/hooks-example/context7/permissions-vs-hooks.md).
- **CI/CD i code review:** [przegląd przykładów](course-materials/cicd-headless/), [agent review dla różnych CI](course-materials/cicd-headless/agent-review/), [PR-Agent i Qodo](course-materials/cicd-headless/PR-Agent-Qodo/), [Codex i Bitbucket](course-materials/cicd-headless/codex-bitbucket/).
- **Ćwiczenia i dalsza lektura:** [dane syntetyczne](course-materials/exercise-data/), [workflow agentów i oszczędzanie tokenów](course-materials/Research/agent-workflows-and-token-budget-2026-10-24.md).

Przykłady są opcjonalne: skopiowanie repozytorium nie instaluje hooków ani profili. Przed uruchomieniem sprawdź instrukcję danego materiału, wersję narzędzia i politykę organizacji.

## Granice

Używaj wyłącznie danych syntetycznych. `course-tools` nie blokuje odczytu .env/secrets. Przed dodaniem prawdziwego klucza API przejdź na profil ścisły i sprawdź blokadę na fałszywej wartości w dokładnie docelowym pliku według [instrukcji Windows](course-materials/agent-configs/codex/WINDOWS-QUICKSTART-PL.md#zanim-dodasz-prawdziwy-klucz-api). Serwer z prawdziwym kluczem uruchamiaj z własnego terminala. Do tego czasu używaj modelu testowego bez klucza. Przed przekazaniem kontekstu agentowi sprawdź politykę organizacji i zakres dostępu. Przejrzyj każdy diff, wynik testów i uprawnienia proponowanych narzędzi. Testów nie zmieniaj po to, by ukryć nieukończone zachowanie.

Możliwość użycia agenta chmurowego, MCP, CLI i pul AI Credits zależy od planu oraz ustawień organizacji. Agent w IDE i agent chmurowy to osobne środowiska. Funkcje edytora mogą się różnić od CLI i od innych IDE. Polecenia i ustawienia narzędzi szybko się zmieniają, więc sprawdzaj je w aktualnej dokumentacji producenta.

Trener: Łukasz Matuszewski · [LinkedIn](https://www.linkedin.com/in/lukaszmatuszewski/) · [X](https://x.com/mrLumatic)
