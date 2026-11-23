# PR-Agent i Codex CLI na własnym GitLabie

Materiał opcjonalny dla zespołów pracujących na GitLabie. Uruchomisz dwa joby review dla tego samego merge requesta. Oba korzystają z OpenRoutera i publikują wynik w dyskusji MR. [Wspólny plik YAML z oboma jobami](gitlab-review-jobs.yml) przeszedł próbę na GitLab Self-Managed 19.5.3 z runnerem Docker (10.11.2026). Wzór zaczyna od ręcznego uruchamiania jobów w prywatnym projekcie testowym.

Pełny pipeline z buildem i automatycznym review Codex na każdym MR pokazuje [gitlab-codex-review/.gitlab-ci.yml](gitlab-codex-review/.gitlab-ci.yml). Sam PR-Agent dla innych platform: [PR-Agent-Qodo](PR-Agent-Qodo/README.md).

## 1. Dodaj pliki do projektu

- Skopiuj [gitlab-review-jobs.yml](gitlab-review-jobs.yml) jako `ci/gitlab-review-jobs.yml`.
- Skopiuj katalog [agent-review](agent-review/) jako `ci/agent-review/`. Zawiera Dockerfile, prompt do review oraz skrypty do uruchamiania Codexa i publikacji komentarza.
- W głównym `.gitlab-ci.yml` dopisz poniższy wpis do listy `include` oraz dodaj etap `review` do istniejącej listy `stages`. Jeśli korzystasz z domyślnej listy etapów, wpisz `stages: [build, test, deploy, review]`. Jeśli masz już joby o tych samych nazwach, zastąp je albo zmień nazwy w kopii szablonu.

```yaml
include:
  - local: /ci/gitlab-review-jobs.yml
```

W głównym pliku upewnij się, że `workflow: rules` dopuszcza pipeline typu merge request. Jeśli masz już własne reguły, zachowaj je i dodaj regułę MR przed regułą, która by go odrzuciła. Poniższy wariant możesz wykorzystać w projekcie testowym, który nie ma jeszcze `workflow`.

```yaml
workflow:
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
    - if: '$CI_COMMIT_BRANCH && $CI_OPEN_MERGE_REQUESTS && $CI_PIPELINE_SOURCE == "push"'
      when: never
    - if: '$CI_COMMIT_BRANCH || $CI_COMMIT_TAG'
```

[Pipelines dla merge requestów w GitLabie](https://docs.gitlab.com/ci/pipelines/merge_request_pipelines/)

Oba joby mają `needs: []`, więc startują od razu, bez czekania na build i testy. Bez tego job z etapu `review` nie uruchomi się, gdy build jest czerwony, a właśnie wtedy review bywa najbardziej przydatne (lekcja z 20.11.2026).

## 2. Zbuduj obraz Codex CLI

Z katalogu głównego projektu uruchom poniższe polecenia po zalogowaniu się do swojego rejestru. Podmień przykładowy adres obrazu.

```bash
docker build -t registry.example.com/team/project/agent-ci:1 ci/agent-review
docker push registry.example.com/team/project/agent-ci:1
```

Runner Docker musi móc pobrać ten obraz i obraz PR-Agent wskazany w YAML. Joby potrzebują też dostępu HTTPS do GitLaba i OpenRoutera. Jeżeli Twój runner używa tagów, dodaj odpowiednie `tags` do obu jobów.

## 3. Ustaw zmienne projektu

W **Settings → CI/CD → Variables** dodaj poniższe wpisy. Dla czterech poświadczeń wybierz `Masked and hidden` i wyłącz rozwijanie wartości. Upewnij się, że zmienne są dostępne w pipeline MR, na którym robisz pilotaż.

| Nazwa | Wartość |
|---|---|
| `REVIEW_API_KEY` | Klucz API OpenRouter używany przez PR-Agent |
| `OPENROUTER_API_KEY` | Klucz API OpenRouter używany przez Codex CLI |
| `GITLAB__PERSONAL_ACCESS_TOKEN` | Token bota GitLab do odczytu MR i publikacji komentarza przez PR-Agent |
| `GITLAB_TOKEN` | Token bota GitLab do publikacji komentarza Codex CLI |
| `CODEX_REVIEW_IMAGE` | Pełny adres obrazu z poprzedniego kroku, np. `registry.example.com/team/project/agent-ci:1`. To zwykła zmienna CI. |

Jeśli oba joby mają korzystać z tego samego klucza OpenRouter, wpisz go pod obiema nazwami. Używaj klucza z limitem wydatków. Token bota utwórz w **Settings → Access tokens** jako token dostępu projektu z zakresem `api`, rolą Developer i datą ważności. W projekcie testowym możesz użyć tego samego tokenu projektu dla obu jobów. Jeżeli Wasza instancja wymaga konta serwisowego, użyj jego tokenu z odpowiednimi uprawnieniami w projekcie. [Zmienne CI/CD](https://docs.gitlab.com/ci/variables/) · [Tokeny dostępu projektu](https://docs.gitlab.com/user/project/settings/project_access_tokens/)

## 4. Uruchom oba review

1. Zapisz konfigurację na gałęzi docelowej projektu. Otwórz mały MR z drugiej gałęzi w tym samym projekcie.
2. W pipeline typu merge request uruchom ręcznie `pr-agent-review` i `codex-review` dla tego samego commita.
3. Sprawdź log każdego joba i jego komentarz w dyskusji MR.

Kiedy konfiguracja działa: oba joby zakończyły się sukcesem, w MR są dwa komentarze, a logi są czytelne. Joby mają `allow_failure`, więc zielony pipeline sam nie potwierdza publikacji komentarza.

Scenariusz pilotażu: w testowym MR dodaj funkcję, która ma przyjmować wartości z domkniętego zakresu, np. port 1-65535, i celowo odrzuć wartość graniczną (`port <= 1` zamiast `port <= 0`). Po pierwszym review dopisz test wartości granicznej i popraw warunek. Powtórz oba review na nowym commicie i sprawdź, czy komentarze odzwierciedlają poprawkę. Weryfikację komentarzy krok po kroku opisuje ćwiczenie [od komentarzy review do testu regresji](../exercises/review-comments-to-regression-test.md).

## 5. Pułapki z próby na żywo

- **`glab ci lint` nie jest testem tej konfiguracji.** W naszej próbie (20.11.2026) lint sprawdzał plik w kontekście domyślnej gałęzi i zgłaszał błąd dla `include: local`, którego tam jeszcze nie było, choć na gałęzi MR plik istniał. Dowodem działania jest pipeline MR, w którym widać oba joby.
- **Push-to-create tworzy projekt prywatny.** Gdy `glab repo create` się nie powiedzie, a Ty wypchniesz gałąź na nieistniejącą ścieżkę, GitLab może utworzyć projekt w Twojej przestrzeni osobistej, domyślnie prywatny. Inni uczestnicy go nie zobaczą, dopóki nie zmienisz widoczności albo nie dodasz ich jako członków. [Tworzenie projektu przez git push](https://docs.gitlab.com/topics/git/project/)
- **Płytki klon.** Przed wypchnięciem klonu utworzonego z `--depth` do nowego serwera wykonaj `git fetch --unshallow`; serwer może odrzucić płytką historię.
- **Saldo dostawcy modeli.** OpenRouter zwraca HTTP 402 przy ujemnym saldzie, także przy BYOK. Sprawdź saldo przed pokazem.

## 6. Przed wdrożeniem w projekcie firmowym: osobny job publikujący

Szablon zawiera ustawienie `CODEX_SANDBOX: danger-full-access` z runnera szkoleniowego. Użyj go wyłącznie w odizolowanym pilotażu na zaufanym kodzie. Na runnerze, który obsługuje sandbox Codexa, ustaw `read-only`.

W pokazanym wariancie agent działa w jobie, który ma jednocześnie klucz modelu i `GITLAB_TOKEN`. Prompt injection w diffie lub w plikach MR może skłonić agenta do użycia albo ujawnienia tokenu. Zalecany układ: job agenta tylko zapisuje raport jako artefakt, a osobny job, który jako jedyny dostaje `GITLAB_TOKEN`, publikuje komentarz. W GitLabie zmienne projektu są domyślnie dostępne dla wszystkich jobów; ogranicz `GITLAB_TOKEN` do jednego joba przez zakres środowiska (environment scope) zmiennej. Sprawdź, czy Twoja wersja i plan GitLaba pozwalają ustawić zakres środowiska zmiennej. [Ograniczanie zakresu zmiennych](https://docs.gitlab.com/ci/environments/#limit-the-environment-scope-of-a-cicd-variable)

Szkic do sprawdzenia w projekcie testowym (nieprzetestowany na żywo). Ustaw zakres środowiska zmiennej `GITLAB_TOKEN` na `review-comment`, usuń z `codex-review` krok `post_review_comment.sh` i dodaj job:

```yaml
codex-review-comment:
  stage: review
  image: "$CODEX_REVIEW_IMAGE"
  needs: [codex-review]
  environment:
    name: review-comment
    action: prepare
  before_script: []
  cache: []
  allow_failure: true
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event" && $CI_MERGE_REQUEST_SOURCE_PROJECT_ID == $CI_PROJECT_ID'
    - when: never
  script:
    - bash ci/agent-review/post_review_comment.sh .agent-review/review.md
```

Job publikujący nie uruchamia modelu, tylko wysyła gotowy raport. Treść raportu nadal pochodzi od agenta, więc traktuj komentarz jako niezaufany tekst. Dodatkowo ogranicz ruch wychodzący joba agenta do GitLaba i dostawcy modelu, jeśli runner na to pozwala.
