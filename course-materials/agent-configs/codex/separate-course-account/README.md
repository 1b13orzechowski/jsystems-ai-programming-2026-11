# Osobne konto Codex na kurs (szkoleniowe obok firmowego)

Cel: pracować na koncie szkoleniowym (np. ChatGPT Business od trenera) tak, żeby firmowe konto, historia i konfiguracja Codex zostały nietknięte. Osobny katalog `CODEX_HOME` rozdziela logowanie, historię i konfigurację Codex na tym samym komputerze i koncie Windows.

Stan: dokumentacja sprawdzona 23.11.2026; wariant Windows z [WINDOWS-QUICKSTART-PL](../WINDOWS-QUICKSTART-PL.md) przetestowany na Codex CLI 0.166.0. [Konfiguracja](https://developers.openai.com/codex/config-reference/) · [Logowanie](https://developers.openai.com/codex/auth/) · [Windows](https://developers.openai.com/codex/windows).

## Drugie konto Codex przez `CODEX_HOME`

Katalog `CODEX_HOME` rozdziela konfigurację, historię i lokalne dane autoryzacji. `CODEX_SQLITE_HOME` przenosi do tego samego katalogu bazę stanu SQLite, która bez tej zmiennej trafia do `CODEX_HOME`, chyba że konfiguracja ustawia `sqlite_home`. Profil wybiera ustawienia; sam nie przełącza konta. Utwórz katalogi kont:

```powershell
New-Item -ItemType Directory -Force -Path "$HOME\.codex-business", "$HOME\.codex-enterprise" | Out-Null
```

Wklej funkcję konta szkoleniowego do PowerShella (albo do `$PROFILE`, jeśli polityka firmy na to pozwala):

```powershell
function codex-business {
    $courseHome = "$HOME\.codex-business"
    # Firmowe poświadczenia OpenAI/Codex z otoczenia nie mogą nadpisać logowania szkoleniowego.
    $authNames = @('CODEX_ACCESS_TOKEN', 'CODEX_API_KEY', 'OPENAI_API_KEY', 'OPENAI_FEDERATION_RULE_ID')
    $previous = @{}
    foreach ($name in @('CODEX_HOME', 'CODEX_SQLITE_HOME') + $authNames) {
        $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
    }
    try {
        foreach ($name in $authNames) {
            Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue
        }
        $env:CODEX_HOME = $courseHome
        $env:CODEX_SQLITE_HOME = $courseHome
        codex --no-daemon -c windows.sandbox=elevated -c features.prefer_mxc=false @args
    }
    finally {
        foreach ($name in $previous.Keys) {
            [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process')
        }
    }
}
```

Konto firmowe zostaje przy zwykłych ustawieniach firmy:

```powershell
function codex-enterprise { $previousCodexHome = $env:CODEX_HOME; try { $env:CODEX_HOME = "$HOME\.codex-enterprise"; codex @args } finally { $env:CODEX_HOME = $previousCodexHome } }
```

W Bashu (Linux, macOS, WSL) dopisz funkcję do `~/.bashrc` albo wklej ją do terminala:

```bash
codex-business() (
  umask 077
  course_home="$HOME/.codex-business"
  mkdir -p -- "$course_home"
  exec env -u CODEX_ACCESS_TOKEN -u CODEX_API_KEY -u OPENAI_API_KEY -u OPENAI_FEDERATION_RULE_ID \
    CODEX_HOME="$course_home" CODEX_SQLITE_HOME="$course_home" \
    codex --no-daemon "$@"
)
```

Na kursie logujesz tylko konto szkoleniowe: `codex-business login`, potem `codex-business login status`. Gdy przekierowanie do lokalnego terminala jest zablokowane, użyj `codex-business login --device-auth`, jeśli workspace dopuszcza logowanie kodem urządzenia. Przeglądarka musi wskazywać konto szkoleniowe i workspace szkoleniowy. Nie kopiuj `auth.json` i nie wyświetlaj jego zawartości. Po kursie wylogujesz konto poleceniem `codex-business logout`. Konto firmowe konfigurujesz zgodnie z polityką firmy. Funkcje działają w bieżącym terminalu; zdefiniuj je ponownie w nowym. Na Windows wystarcza natywny sandbox Codex, bez WSL.

Co robi funkcja konta szkoleniowego:

- Ustawia `CODEX_HOME` i `CODEX_SQLITE_HOME` tylko na czas uruchomienia. PowerShell przywraca potem wcześniejsze wartości; wersja Bash działa w podpowłoce, więc nie zmienia bieżącego terminala.
- Pomija odziedziczone `CODEX_ACCESS_TOKEN`, `CODEX_API_KEY`, `OPENAI_API_KEY` i `OPENAI_FEDERATION_RULE_ID`. Na laptopie firmowym takie zmienne mogłyby po cichu zastąpić logowanie szkoleniowe.
- Uruchamia Codex z `--no-daemon`, czyli bez wspólnego serwera w tle, który mógł zostać uruchomiony dla konta firmowego i jego `CODEX_HOME`. Standardowy test z [WINDOWS-QUICKSTART-PL](../WINDOWS-QUICKSTART-PL.md) na maszynie kursowej nadal korzysta z serwera w tle.
- Na Windows wymusza przetestowany wariant kursu: `elevated` z `prefer_mxc = false`. Nowy `CODEX_HOME` ma pusty `config.toml`, więc bez tych opcji ustawienia z quickstartu w `~\.codex` by nie obowiązywały. MXC jest opcją niedomyślną, opisaną w [porównaniu backendów](../../../Research/codex-windows-sandbox-troubleshooting-2026-10-15.md#3-windows-sandbox-backends-in-0162).

Izolacja obejmuje logowanie, konfigurację i lokalny stan Codex CLI, nie pliki ani inne narzędzia. Dostęp do plików zależy od uprawnień systemu i sandboxu Codex; menedżer poświadczeń Git, `gh`, `glab`, klucze SSH i przeglądarka pozostają wspólne. Do ćwiczeń używaj repozytoriów szkoleniowych. Wtyczki IDE uruchamiają własne procesy. Jeżeli firmowa polityka blokuje funkcję lub logowanie, skorzystaj z maszyny szkoleniowej. Szersze omówienie: [konto szkoleniowe na laptopie firmowym](../../../Research/course-account-on-company-laptop-2026-10-28.md).

### Profile: analiza i implementacja

Pliki [course-analysis.config.toml](course-analysis.config.toml) (tylko odczyt) i [course-implementation.config.toml](course-implementation.config.toml) (zapis w projekcie) skopiuj do `$HOME\.codex-business\`. Uruchom `codex-business --profile course-analysis` albo `codex-business --profile course-implementation`.

- Profil z `sandbox_mode` to konfiguracja klasyczna. Projekt może wybierać nazwany profil uprawnień o wyższym priorytecie; wtedy użyj `codex-business -c 'default_permissions="course-review"'` do analizy, a `course-workspace` do implementacji. Nie mieszaj obu mechanizmów bez sprawdzenia wyniku: `/permissions`, `/status`, `codex doctor --all`.
- Nie dodawaj `[profiles.nazwa]`: aktualne profile to osobne pliki `$env:CODEX_HOME\nazwa.config.toml`. Nie ustawiaj modelu w projekcie, jeśli ma go wybierać profil użytkownika.
- Proxy sieciowe (`network_proxy`) zostaw wyłączone, tak jak w konfiguracji kursu. Bez proxy reguły domen nie ograniczają ruchu poleceń, dlatego profile kursowe ich nie zawierają.

## Podagent tylko do odczytu

Przykładowa rola [luna-reader.toml](../agents/luna-reader.toml) (model Luna do ograniczonej analizy z cytowaniem źródeł) jest w katalogu `agents/` razem z innymi rolami. Skopiuj ją do `.codex/agents/` analizowanego projektu i jawnie poproś o delegację; kontrolę tylko do odczytu zapewnia sandbox rodzica, nie sama instrukcja w roli.
