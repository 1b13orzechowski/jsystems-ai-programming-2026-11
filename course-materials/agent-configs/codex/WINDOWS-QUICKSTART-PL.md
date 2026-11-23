# Codex na Windows: ustawienia użytkownika i kursu

## 1. Ustaw konfigurację użytkownika

Jeśli provisioning poprosi o UAC, zatwierdza go uprawniony użytkownik lub IT. Bez potrzebnych uprawnień poproś prowadzącego/IT o przygotowanie środowiska; nie obchodź polityki firmy.

Otwórz **zwykły PowerShell Windows**. Znajdź plik używany przez Codex:

```powershell
if ($env:CODEX_HOME) {
    $codexSettings = Join-Path $env:CODEX_HOME 'config.toml'
} else {
    $codexSettings = Join-Path $env:USERPROFILE '.codex/config.toml'
}
notepad $codexSettings
```

Zrób kopię pliku przed edycją. **Scal poniższe wpisy z istniejącym plikiem**; zachowaj pozostałe ustawienia i nie dodawaj drugiej tabeli `[windows]` ani `[features]`.

```toml
# Przykład do demonstracji: wyłącza lokalny sandbox. Pozostaw zakomentowany.
# sandbox_mode = "danger-full-access"

# Normalny sandbox i automatyczny recenzent próśb o dodatkowy dostęp.
default_permissions = ":workspace"
approval_policy = "on-request"
approvals_reviewer = "auto_review"

[windows]
sandbox = "elevated"

[features]
prefer_mxc = false
network_proxy = false
```

Zakomentuj inne aktywne `sandbox_mode` i usuń aktywną tabelę `[sandbox_workspace_write]`, jeśli przechodzisz na ten system profili. Nie łącz obu systemów konfiguracji. `prefer_mxc = false` wraz z wyborem `elevated` ustawia kursowy wariant Windows. Wpis `network_proxy = false` zostaw jawnie: scalanie zachowuje pozostałe ustawienia, więc wcześniejsze `network_proxy = true` inaczej pozostałoby aktywne. Polityka administratora lub jawne nadpisanie ustawień nadal może mieć wyższy priorytet.

## 2. Zrestartuj serwer i rozpocznij nową rozmowę

Zakończ zadania agentów i zamknij interfejsy Codex. Restart serwera rozłącza wszystkie korzystające z niego sesje tego użytkownika. W zwykłym PowerShellu, w katalogu swojego repozytorium, wykonaj kolejno:

```powershell
$env:Path = "$env:APPDATA\npm;$env:Path"
codex app-server daemon restart
codex app-server daemon version
codex
```

Sprawdź, czy restart się udał. Ustaw PATH przed restartem daemona. Wiersz z PATH udostępnia zainstalowany Playwright CLI w tym oknie i uruchamianym z niego Codexie; nie instaluje narzędzia. Uruchom nową rozmowę, aby sprawdzić nowe domyślne ustawienia. Wznowiona rozmowa może przywrócić zapisany profil. Nie używaj `--no-daemon` w standardowym teście kursu.

Po aktualizacji **samego CLI**, gdy chcesz użyć tej samej wersji serwera, wykonaj przed restartem `codex app-server daemon update --from-cli` i zatwierdź zastąpienie pakietu. Nie potrzeba tego po zwykłej edycji konfiguracji. Komendy sprawdzono w pomocy CLI 0.166.0. W TUI alternatywą jest `/daemon` i **Restart background server**.

## 3. Wybierz, gdzie ma obowiązywać profil kursowy

- **Tylko w repozytorium kursowym:** pozostaw globalne `default_permissions = ":workspace"`. Zaufana konfiguracja `.codex/config.toml` tego repozytorium wybiera `course-tools` i definiuje profil oraz reguły w `.codex/rules/course.rules`.
- **Dla wszystkich swoich projektów:** scal definicje `[permissions]` z [permissions.toml](permissions.toml) albo [config.toml](config.toml) do konfiguracji użytkownika. Następnie ustaw w niej `default_permissions = "course-tools"` i skopiuj przejrzany [rules/course.rules](rules/course.rules) do `$CODEX_HOME/rules/course.rules` (domyślnie `~/.codex/rules/course.rules`). Reguły będą wtedy obowiązywać użytkownika w innych projektach. Konfiguracja konkretnego projektu może wybrać inny profil.

Samo wpisanie nazwy `course-tools` globalnie nie wystarczy: definicja profilu musi być dostępna również poza repozytorium kursu. Nie kopiuj całego pliku na istniejącą konfigurację bez przejrzenia; scal potrzebne sekcje. Pełny przykład zawiera też opcjonalne modele i MCP.

## 4. Sprawdź działanie

W nowej sesji sprawdź `/permissions`, `/status` i `/mcp`. W repozytorium kursowym oczekujemy `course-tools` i połączenia Context7. Profil plików/sieci i recenzent zgód są oddzielnymi ustawieniami: kombinacja `on-request` + `auto_review` włącza „Approve for me” także z własnym profilem.

Poproś agenta kolejno o:
1. Context7: `resolve-library-id` dla Tailwind CSS, potem `query-docs` przez zwrócony identyfikator.
2. `gh repo view OWNER/REPO --json name` dla swojego repozytorium.
3. Osobne `playwright-cli open about:blank --browser=chrome --headed`, `playwright-cli snapshot`, `playwright-cli close`. Przy `open` decyzję podejmuje Auto-review, a nie Ty.

Sukces tych trzech narzędzi nie dowodzi izolacji: działają również przy wyłączonym sandboxie. Poproś dodatkowo o dwa osobne polecenia **bez eskalacji, bez wyjątku allow i bez próby ponowienia poza sandboxem**: zapis nowego pliku syntetycznego w workspace (ma się udać) oraz zapis pliku o unikalnej nazwie poza wszystkimi dozwolonymi katalogami, np. w katalogu domowym, jeśli nie jest workspace/temp (ma być odmowa). Nie zatwierdzaj eskalacji tego testu; auto-review może ją zatwierdzić bez ręcznego pytania, dlatego sprawdź w przebiegu narzędzi, że polecenie rzeczywiście pozostało w sandboxie. Jeśli plik poza granicą powstał, usuń wyłącznie ten rozpoznany plik z własnego terminala. Jeśli zapis poza granicą się uda, nie uznawaj sandboxa za zweryfikowany; sprawdź efektywną konfigurację. To osobny test granicy, nie powtórka wywołań gh/Playwright.

W tym teście użyj domyślnej sesji Playwright i komendy przed opcjami, aby pasowała reguła prefiksu. Jeśli narzędzie nie działa, przekaż prowadzącemu komendę i niesekretny błąd. 401 z sandboxa nie oznacza automatycznie wylogowania użytkownika. Nie drukuj tokenów ani całego środowiska.

Porównanie błędów ACL/MXC i zachowania formularzy: [fakty i ograniczenia Codex](../../Research/codex-sandbox-facts-and-limitations-2026-11-06.md).

### Zanim dodasz prawdziwy klucz API

Dane testowe mogą być syntetyczne, ale klucz API jest prawdziwym sekretem. Nie dodawaj go do workspace z aktywnym `course-tools`.

Najpierw utwórz plik z **fałszywą** wartością w dokładnie tej lokalizacji i pod tą nazwą, których użyjesz dla klucza, np. `app/.env`. Wybierz profil ścisły `course-workspace` w nowej sesji i sprawdź blokadę odczytu tego pliku. Lista obejmuje `.env`, `.env.local`, `.env.dev`, `.env.prod`, `.env.test` i wskazane `secrets`; nie obejmuje dowolnej nazwy typu `.env.development.local`. Jeśli test nie potwierdzi ochrony, nie dodawaj klucza.

Gdy plik klucza ma pozostać w repo, ustaw także skuteczny domyślny profil projektu na `default_permissions = "course-workspace"` (nie tylko wybór bieżącej sesji), zrestartuj daemon i sprawdzaj `/permissions` w każdej nowej rozmowie. Nie wznawiaj starych rozmów `course-tools`. Na czas obecności klucza wyłącz wyjątki `allow` dla gh/Playwright we wszystkich wczytywanych regułach projektu i użytkownika; zachowaj reguły `forbidden`. Narzędzia hostowe wykonuj samodzielnie. Przed powrotem do `course-tools` usuń rzeczywisty klucz z workspace.

Blokada obejmuje także serwer i testy uruchamiane przez agenta, więc uruchomienia z prawdziwym kluczem wykonuj z własnego terminala. Wyjątki hostowe gh/Playwright mogą pod profilem ścisłym przestać działać. Samej zmiennej środowiskowej nie traktuj jako ochrony przed agentem.

Do tego czasu używaj modelu testowego bez klucza. Używaj odwoływalnego klucza z ograniczonym budżetem; nie wpisuj go do rozmowy ani Git.

## 5. Tokeny `gh` i `glab` w sandboxie

`gh` i `glab` zapisują token w Menedżerze poświadczeń Windows na Twoim koncie. Sandbox `elevated` uruchamia polecenia jako osobny użytkownik Windows i tego tokenu nie odczyta: w Codexie `glab` lub `gh` zgłasza brak logowania albo HTTP 401, choć w Twoim terminalu działa. Wyjątki `allow` z `course.rules` uruchamiają wybrane odczytowe polecenia `gh` poza sandboxem, więc tam token działa. Pozostałe polecenia, w tym `glab`, potrzebują tokenu w zmiennej środowiskowej.

Przed uruchomieniem Codexa ustaw token w tym samym oknie PowerShella. Podmień host na adres swojego GitLaba:

```powershell
$env:GITLAB_HOST = 'gitlab.example.com'
$t = Read-Host 'Token GitLab' -AsSecureString
$env:GITLAB_TOKEN = [Net.NetworkCredential]::new('', $t).Password
Remove-Variable t
codex
```

Dla GitHuba ustaw w ten sam sposób `$env:GH_TOKEN`. Na kursowym GitLabie prowadzący przekazuje gotowy wiersz z `$env:GITLAB_HOST` i `$env:GITLAB_TOKEN`. Osobną sesję `glab`, która nie zmienia firmowego logowania, otwiera [glab-course-session.ps1](../../cicd-headless/glab-course-session.ps1).

Codex domyślnie przekazuje poleceniom zmienne z `TOKEN`, `KEY` i `SECRET` w nazwie (`shell_environment_policy.ignore_default_excludes` ma domyślnie wartość `true`; [dokumentacja](https://learn.chatgpt.com/docs/config-file/config-advanced), sprawdzone 23.11.2026). Jeśli Twoja konfiguracja ustawia `ignore_default_excludes = false` albo `inherit = "core"`, dodaj filtr `include` dla tych zmiennych. Jeśli `glab` w Codexie nadal nie widzi tokenu, uruchom `codex --no-daemon`: serwer w tle uruchomiony wcześniej z innego okna może nie znać zmiennych tego terminala.

Agent widzi ten token i może go użyć. Używaj tokenu szkoleniowego z najmniejszym potrzebnym zakresem (`read_api` do odczytu MR, `api` tylko do komentowania), nigdy tokenu z dostępem do firmowego kodu.

## 6. Typowe błędy

- **`windows unelevated restricted-token sandbox cannot enforce deny-read restrictions`:** Codex wybrał backend `unelevated`, który nie egzekwuje blokad odczytu. Sprawdź, czy konfiguracja użytkownika ma `[windows] sandbox = "elevated"` (krok 1) i czy uruchamiasz nową rozmowę. Nie wyłączaj sandboxa i nie przechodź na MXC tylko po to, żeby obejść ten błąd.
- **Pomocnik MXC zgłasza brak `SYSTEMROOT` podczas wczytywania `AGENTS.md`:** poprawka przekazywania `SystemRoot` jest w Codex CLI od wersji 0.165.0 (sprawdzone 10.11.2026). Wykonaj `codex --version`, a przy starszej wersji `codex update`, potem `codex app-server daemon update --from-cli` i restart serwera (krok 2). Na komputerze zarządzanym przez firmę użyj wersji zatwierdzonej przez IT. [Aktualizowanie Codex CLI](https://learn.chatgpt.com/docs/developer-commands?surface=cli)
- **MXC** (`prefer_mxc = true`) nie jest wariantem kursu. Co o nim wiemy, z datami i wersjami: [raport sandboxa Windows](../../Research/codex-windows-sandbox-compatibility-2026-11-05.md#mxc-a-non-default-option).

## Jak to działa

Sandbox ogranicza zwykłe polecenia. `:workspace` pozwala zapisywać w workspace i katalogach tymczasowych. `course-tools` dodatkowo włącza sieć i nie dodaje OS-owych blokad odczytu .env/secrets: używaj go wyłącznie na syntetycznych danych kursowych.

Brak blokad odczytu jest celowy. Od Codex 0.162.1 profil z wpisami deny-read uniemożliwia uruchomienie polecenia poza sandboxem, a właśnie tego potrzebują wyjątki `allow` dla gh i Playwright. Na kursowej maszynie Windows (CLI 0.166.0) eskalacja gh/Playwright nie działała pod profilem ścisłym, a działała pod `course-tools`. Dlatego na maszynach kursowych nie trzymaj w workspace żadnych prawdziwych sekretów. W prawdziwych projektach i na własnym laptopie używaj profilu `course-workspace`, który blokuje odczyt wskazanych plików .env/secrets.

Profile kursowe nie zawierają list domen. Lista domen działa tylko z włączonym proxy sieciowym (`network_proxy`), którego kurs nie włącza, więc niczego by nie chroniła. `network.enabled = true` pozwala korzystać z sieci poleceniom w sandboxie; polecenia uruchamiane przez reguły `allow` działają poza sandboxem i tego ustawienia nie dotyczy.

Reguły `allow` pozwalają wskazanym odczytowym poleceniom gh oraz Playwright snapshot/close działać **poza sandboxem**, z uprawnieniami użytkownika Windows. To daje im dostęp do logowania i przeglądarki. `playwright-cli open` ma regułę `prompt`, bo prefiks nie ogranicza adresu URL: każde otwarcie ocenia recenzent Auto-review, bez angażowania człowieka. Zatwierdza about:blank, localhost i adresy aplikacji kursowej, a odrzuca `file://`, inne adresy oraz opcje `--profile`, `--persistent` i `--config`. Inne działania podlegają zwykłej polityce; `prompt` trafia do recenzenta, a `forbidden` blokuje. Auto-review nie recenzuje każdej dozwolonej komendy. Prefiksy nie filtrują też opcji: `snapshot --filename` może zapisać plik poza workspace, a przy `open` opcje `--profile`, `--persistent` lub `--config` wybierałyby dodatkowy stan lub konfigurację, dlatego odrzuca je recenzent. Używaj własnej sesji kursowej, danych syntetycznych i przejrzanych opcji.

| Profil | Zastosowanie |
|---|---|
| `course-tools` | Domyślny w kursowym repo: edycja, sieć, wyjątki hostowe z reguł; bez deny-read sekretów. |
| `course-workspace` | Ścisła edycja do prawdziwych projektów i na własny laptop: blokady wskazanych .env/secrets; może ograniczać eskalację hostową. |
| `course-review` | Opcjonalny: workspace tylko do odczytu; blokuje istniejące pliki .env/secrets (tylko wzorcami glob, więc startuje także bez tych plików); temp zapisywalne. |

„Low integrity” to etykieta ograniczeń procesu Windows. Zwykły PowerShell zwykle ma poziom medium, administrator high, a low ogranicza m.in. zapis do zasobów zwykłych aplikacji. To nie jest komunikat o uszkodzeniu programu. AppContainer nakłada dodatkowe ograniczenia; sam poziom low nie rozstrzyga przyczyny błędu narzędzia.

WezTerm jest opcjonalnym terminalem. Nie wybiera sandboxa. Nie wykonano tu testu jego działania ani porównania stabilności.

Szczegóły i wyniki pomiarów: [raport dla agentów](../../Research/codex-windows-sandbox-compatibility-2026-11-05.md). Źródła: [profile](https://learn.chatgpt.com/docs/permissions), [Auto-review](https://learn.chatgpt.com/docs/sandboxing/auto-review), [Windows](https://learn.chatgpt.com/docs/windows/windows-sandbox), [reguły](https://learn.chatgpt.com/docs/agent-configuration/rules).
