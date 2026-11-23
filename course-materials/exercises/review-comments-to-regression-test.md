# Od komentarzy review do testu regresji

Ćwiczenie opcjonalne. Użyjesz lokalnego agenta do zweryfikowania komentarzy z automatycznego review (np. PR-Agent, Codex w CI, Copilot albo Codex Cloud) w pull requeście na GitHubie lub w merge requeście na GitLabie. Agent ma sprawdzić jedną uwagę w kodzie, rozstrzygnąć ją testem i przygotować odpowiedź do zatwierdzenia. Konfigurację review w CI opisują [PR-Agent](../cicd-headless/PR-Agent-Qodo/README.md) i, dla GitLaba, [PR-Agent i Codex CLI na własnym GitLabie](../cicd-headless/gitlab-review-jobs.md).

## Czego potrzebujesz

- PR lub MR z co najmniej jednym komentarzem automatycznego review. Najlepiej sprawdza się mały MR z celowym błędem granicznym, np. funkcja, która ma przyjmować porty 1-65535, a odrzuca port 1 (`port <= 1` zamiast `port <= 0`). Jeśli joby z modelem nie zadziałają, pracuj na wspólnym PR/MR z zapisanymi wcześniej komentarzami botów.
- Lokalny klon aplikacji na gałęzi PR/MR i działające testy projektu.
- CLI platformy: `gh` dla GitHuba albo `glab` dla GitLaba, zalogowane kontem z dostępem do projektu. Składnię sprawdzaj w `gh <polecenie> --help` lub `glab <polecenie> --help`.
- Skill `respond-to-code-review` z publicznego [agent-toolbox](https://github.com/EdukeyTeam/agent-toolbox/tree/main/skills/respond-to-code-review), zainstalowany np. poleceniem `npx --yes skills@latest add EdukeyTeam/agent-toolbox --skill respond-to-code-review`.

Uprawnienia: do odczytu dyskusji wystarcza token z odczytem API (GitLab: `read_api`, GitHub: odczyt pull requestów). Do publikacji odpowiedzi potrzebujesz zapisu (GitLab: `api` i co najmniej rola Reporter, GitHub: zapis pull requestów). Do klonowania przez HTTPS token potrzebuje odczytu repozytorium. [Uprawnienia GitLab](https://docs.gitlab.com/user/permissions/#project-merge-requests) · [Zakresy tokenów GitLab](https://docs.gitlab.com/user/profile/personal_access_tokens/#personal-access-token-scopes) · [Uprawnienia tokenów GitHub](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens)

Na Windows z sandboxem `elevated` agent nie odczyta tokenu `gh` ani `glab` z Menedżera poświadczeń. Ustaw token w zmiennej środowiskowej przed uruchomieniem agenta, jak w [instrukcji Windows](../agent-configs/codex/WINDOWS-QUICKSTART-PL.md#5-tokeny-gh-i-glab-w-sandboxie). Na szkoleniowym GitLabie możesz też otworzyć [tymczasową sesję glab](../cicd-headless/glab-course-session.ps1), która nie zmienia firmowego logowania.

## Kroki

1. Otwórz PR/MR w przeglądarce i przeczytaj komentarze botów. Ustal kontrakt zmiany z opisu PR/MR, np. które wartości mają zostać przyjęte, a które zastąpione wartością domyślną.
2. Pobierz gałąź do lokalnego klonu i uruchom agenta w tym klonie. Gdy agent pracuje w innym katalogu niż klon, dodaj klon jako katalog roboczy (w Codexie: `--add-dir <ścieżka>`).
3. Poproś agenta ze skillem `respond-to-code-review` o pobranie dyskusji, diffu i statusu CI przez CLI platformy, zweryfikowanie jednej uwagi w kodzie i pokazanie dowodu w teście. Gdy dwa boty wskazują to samo, sprawdź, czy ich zgodność wynika z kodu.
4. Po sprawdzeniu propozycji pozwól agentowi dodać test, uruchomić go na wersji z PR/MR (ma się nie udać z oczekiwanego powodu), a potem po lokalnej poprawce (ma przejść).
5. Poproś o krótką odpowiedź z wynikiem. Przeczytaj ją i dopiero wtedy pozwól ją opublikować. Na wspólnym MR tylko komentujesz; własny commit i ponowne review zrób we własnym PR/MR.

### Prompt do weryfikacji feedbacku

```text
Użyj $respond-to-code-review dla tego PR/MR:
<pełny URL pull requesta lub merge requesta>

Pobierz przez gh albo glab dyskusje, diff i status CI. Wskaż, gdzie
automatyczni recenzenci zgadzają się w ocenie zmienionej funkcji.
Sprawdź kontrakt z opisu PR/MR i kod w moim lokalnym klonie.
Podaj wejście, wynik oczekiwany, wynik rzeczywisty i minimalny test,
który rozstrzyga uwagę. Rozróżnij test uruchomiony od zaproponowanego.
Przygotuj szkic odpowiedzi. Zaczekaj na moją akceptację przed edycją
kodu albo publikacją odpowiedzi.
```

## Przydatne polecenia

GitHub:

```bash
gh pr view <numer> --comments
gh pr diff <numer>
gh pr checks <numer>
gh api repos/<właściciel>/<repo>/pulls/<numer>/comments --paginate
```

GitLab:

```bash
glab mr view <numer> --comments
glab mr diff <numer>
glab api "projects/<grupa>%2F<projekt>/merge_requests/<numer>/discussions" --paginate
```

Żeby odpowiedzieć w konkretnym wątku, podaj agentowi ID dyskusji z wyniku `glab api`. Po zatwierdzeniu tekstu agent może użyć `glab mr note create` z opcją `--reply`. [API dyskusji w GitLabie](https://docs.gitlab.com/api/discussions/#add-a-note-to-an-existing-merge-request-thread)

Jednorazowy klon z GitLaba, w którym Git bierze token z `glab` tylko dla tego polecenia, bez zmiany globalnej konfiguracji Git:

```bash
git -c credential.helper= -c "credential.helper=!glab auth git-credential" clone --branch <gałąź> https://<host>/<grupa>/<projekt>.git
```

## Wariant: review kolegi

Dodaj osobę z sąsiedniego stanowiska jako recenzenta swojego PR/MR (GitLab: co najmniej rola Reporter w projekcie). Każdy czyta diff cudzej zmiany (`glab mr diff <numer> -R <grupa>/<projekt>` albo `gh pr diff <numer> -R <właściciel>/<repo>`), zostawia jedną uwagę, a autor odpowiada na nią tym samym promptem.

## Kiedy ćwiczenie jest zaliczone

- Jedna uwaga recenzenta jest rozstrzygnięta testem: wynik przed poprawką i po niej.
- Odpowiedź rozróżnia test uruchomiony od zaproponowanego i nie twierdzi, że coś przeszło, jeśli nie zostało uruchomione.
- Nic nie zostało opublikowane bez Twojej akceptacji.
