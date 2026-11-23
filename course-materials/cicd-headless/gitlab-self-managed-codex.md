# GitLab Self-Managed w ChatGPT i Codex

Materiał opcjonalny dla zespołów z własną instancją GitLaba. Stan sprawdzony 10.11.2026 na szkoleniowej instancji GitLab Self-Managed 19.5 i przestrzeni roboczej ChatGPT Business. Interfejs ChatGPT zmienia się często: nazwy przycisków i wynik punktów 6-7 sprawdź ponownie przed użyciem.

Jeśli administrator udostępnił już wtyczkę GitLab Self-Managed, przejdź od razu do [logowania na konto GitLab](#5-logowanie-na-konto-gitlab). Kroki 1-4 są dla osób, które konfigurują aplikację dla swojej instancji GitLaba. Potrzebujesz uprawnień administratora lub właściciela przestrzeni ChatGPT oraz uprawnień do rejestracji aplikacji OAuth w GitLabie.

W próbie potwierdziliśmy odczyt projektów w zwykłym czacie ChatGPT. Repozytoria z instancji Self-Managed pojawiły się też w [ustawieniach Code Review](#6-gitlab-self-managed-w-ustawieniach-code-review). Publikacja review w merge requeście i wybór repozytorium w środowiskach Codex Cloud nie zadziałały (punkty 6 i 7).

- [Instrukcja OpenAI konfiguracji szablonu GitLab Self-Managed](https://help.openai.com/en/articles/20001487-setting-up-the-gitlab-self-managed-app-template-for-chatgpt-and-codex)
- [Konfiguracja GitLaba i środowisk projektu w Codex Cloud](https://learn.chatgpt.com/docs/third-party/gitlab)

## 1. Otwórz szablon GitLab Self-Managed

W [konsoli administratora ChatGPT](https://admin.openai.com/) wybierz właściwą przestrzeń roboczą, przejdź do **Wtyczek** i w zakładce **Publiczny** wyszukaj `GitLab`. Otwórz **GitLab (Beta)**.

Na karcie wtyczki w sekcji **Aplikacje** kliknij **GitLab Self-Managed**, oznaczony jako **Szablon**. Jeśli Twoja konsola odsyła do katalogu aplikacji, wejdź w **Wtyczki → Zarządzaj starszymi aplikacjami → Katalog** i wybierz ten sam szablon.

## 2. Skopiuj adres przekierowania z ChatGPT

W oknie **Nowa aplikacja GitLab Self-Managed** podaj nazwę, np. `GitLab firmowy`, oraz krótki opis, np. `Odczyt repozytoriów, merge requestów i pipeline'ów na firmowym GitLabie`. W sekcji **Instancja GitLab** wpisz samą nazwę hosta, np. `gitlab.example.com`, bez `https://`, portu i ścieżki.

Kliknij ikonę kopiowania obok pola **Adres URL przekierowania OAuth**. Użyj dokładnego adresu z własnego formularza. Zostaw kartę otwartą. Identyfikator i tajny klucz klienta uzupełnisz po utworzeniu aplikacji w GitLabie.

## 3. Utwórz aplikację OAuth w GitLabie

W osobnej karcie otwórz własnego GitLaba. Wybierz **Admin → Applications** dla aplikacji zarządzanej przez administratora instancji albo **Settings → Applications** w grupie, jeśli zarządzasz aplikacją jako właściciel grupy.

Kliknij **New application** i podaj nazwę, np. `ChatGPT i Codex`. W polu **Redirect URI** wklej adres skopiowany z ChatGPT. Pozostaw włączone **Confidential**. W sprawdzonej konfiguracji **Trusted** było wyłączone, dzięki czemu GitLab wyświetla użytkownikowi ekran zgody. **Device authorization grant** pozostaje wyłączone, ponieważ połączenie używa przekierowania w przeglądarce. [Dokumentacja OAuth GitLaba](https://docs.gitlab.com/integration/oauth_provider/)

Zaznacz tylko trzy zakresy wymagane przez szablon: `api`, `write_repository` i `openid`. Pole `openid` znajduje się niżej na liście zakresów. Kliknij **Save application**.

GitLab wyświetli **Application ID** i **Secret**. Skopiuj każdą wartość ikoną obok jej pola. Zachowaj kartę do chwili, gdy wkleisz obie wartości w ChatGPT; nie zapisuj sekretu w notatkach ani w repozytorium.

## 4. Opublikuj aplikację w przestrzeni roboczej

Wróć do formularza ChatGPT. Wklej **Application ID** w pole **Identyfikator klienta OAuth**, a **Secret** w pole **Tajny klucz klienta OAuth**. Kliknij **Utwórz wersję roboczą**.

Jeśli ChatGPT zgłosi błąd tworzenia aplikacji, otwórz kartę wtyczki **GitLab (Beta)** w osobnej karcie przeglądarki. W sekcji **Aplikacje** sprawdź, czy pojawiła się wersja robocza pod wybraną nazwą. W naszej próbie wersja robocza powstała mimo komunikatu o błędzie. Jeśli istnieje, otwórz ją i kontynuuj. Przed ponowieniem sprawdź zgodność hosta, adresu przekierowania i danych klienta OAuth. [Rozwiązywanie problemów z szablonem](https://help.openai.com/articles/20001487#troubleshooting-gitlab-self-managed-app-setup)

Otwórz wersję roboczą oznaczoną jako **Private**. Sprawdź listę narzędzi odczytu (**Read tools**) i zapisu (**Write tools**), a następnie kliknij **Publish**. W oknie publikacji użyj **Configure tools**, aby wybrać dostępne narzędzia, oraz **Configure approvals**, aby ustawić, kiedy ChatGPT ma pytać o zgodę. Rozsądny start: odczyt bez pytania, zgoda przed każdym zapisem.

Po publikacji sprawdź, czy aplikacja ma status **Enabled**, a pole **URL** wskazuje na API Twojego hosta GitLab. W sekcji **Availability** opcja **Available** pozwala członkom zainstalować wtyczkę samodzielnie, a **Installed** instaluje ją domyślnie w przestrzeni roboczej. [Zarządzanie dostępem do wtyczek](https://help.openai.com/en/articles/11509118-admin-controls-security-and-compliance-for-plugins-and-apps)

## 5. Logowanie na konto GitLab

Gdy administrator udostępni wtyczkę, połączysz własne konto GitLab bez uprawnień administratora. Wybierz w ChatGPT właściwą przestrzeń roboczą i przygotuj dane logowania do GitLaba.

W ustawieniach swojego konta otwórz **Settings → Plugins** i wybierz wtyczkę pod nazwą nadaną przez administratora. Przy ustawieniu **Installed** znajdziesz ją na liście zainstalowanych wtyczek; przy **Available** zainstalujesz ją najpierw przez **Browse directory**. Na karcie wtyczki wybierz **Connect**, a w oknie połączenia przejdź dalej do swojego GitLaba. Każdy użytkownik łączy własne konto.

Po przekierowaniu sprawdź adres instancji i zaloguj się. Na ekranie zgody sprawdź nazwę aplikacji, aktywne konto i zakres dostępu. Jeśli GitLab ostrzega o uprawnieniach administratora, wybierz **Cancel** i przełącz się na zwykłe konto przed ponowieniem połączenia. Na właściwym koncie kliknij **Authorize**.

Po powrocie do ChatGPT sprawdź, czy Twoje konto jest widoczne w sekcji **Connected accounts**. Żeby sprawdzić odczyt danych, otwórz nowy czat, wpisz `@git` i wybierz wtyczkę. Zapytaj, jakie projekty widzi na tej instancji, albo podaj adres testowego merge requesta i poproś o jego tytuł.

## 6. GitLab Self-Managed w ustawieniach Code Review

Otwórz **Settings → Code Review**. W sekcji **Repositories** wybierz dostawcę **GitLab**, a następnie z listy **GitLab connection** wybierz połączenie Self-Managed. W naszej próbie na liście pojawiły się repozytoria z instancji. Kliknij wybrane repozytorium, aby otworzyć jego ustawienia review. [Ustawienia Code Review dla GitLaba](https://chatgpt.com/settings/code-review?provider=gitlab)

W ustawieniach repozytorium włącz **Automatic review**. Ustaw **Review**, aby wybrać, czyje merge requesty ma sprawdzać Codex, oraz **Trigger**, aby wybrać zdarzenie uruchamiające review. Ustaw wprost **Team PRs** lub **All PRs**: w naszych próbach opcja **Follow personal preferences** nie zawsze dawała oczekiwany wynik.

Publikacja review na merge requeście wymaga konta serwisowego z dostępem do projektu oraz podpisanego webhooka projektu lub grupy. OpenAI opisuje konfigurację konta serwisowego w **Codex Cloud → Settings → Connectors**; integracja wymaga GitLaba 19.0 lub nowszego. Po konfiguracji test to komentarz `@codex review` w testowym merge requeście. [Ustawienia konektorów](https://chatgpt.com/codex/cloud/settings/connectors)

Wynik próby z 10.11.2026: panel **Connectors** pokazywał połączenia GitHub i GitLab.com, bez połączenia Self-Managed, więc konta serwisowego nie dało się skonfigurować opisaną ścieżką. Projekt nie miał webhooka, a komentarz `@codex review` pozostał bez reakcji. Publikacja review Codex Cloud w GitLab Self-Managed pozostaje niepotwierdzona. Wszystkie te funkcje wymagają, żeby usługi OpenAI łączyły się z Twoją instancją przez internet. Gdy GitLab działa tylko w sieci firmowej, review uruchamiasz w CI, jak w [PR-Agent i Codex CLI na własnym GitLabie](gitlab-review-jobs.md).

## 7. Repozytoria GitLab w Codex Cloud

W sprawdzonym kreatorze środowisk Codex Cloud opcja **GitLab** pokazywała wyłącznie repozytoria z **GitLab.com**; repozytoriów z instancji Self-Managed nie dało się wybrać. Sprawdziliśmy **Settings → Codex Cloud → Environments** (**Create environment** oraz **Manage connections** przy edycji środowiska) i starszy widok **Legacy Codex Cloud** pod bezpośrednim adresem. [Dokumentacja środowisk](https://learn.chatgpt.com/docs/environments/cloud-environments) · [Legacy Codex Cloud](https://chatgpt.com/settings/cloud-environments)

Do pracy z GitLab Self-Managed w chmurze używaj wtyczki w zwykłym czacie ChatGPT zgodnie z [punktem 5](#5-logowanie-na-konto-gitlab).
