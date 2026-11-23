<#
.SYNOPSIS
    Tymczasowa sesja PowerShell z glab zalogowanym na szkoleniowy GitLab.

.DESCRIPTION
    Opcjonalny pomocnik do kursów z GitLabem. Firmowe logowanie glab zostaje nietknięte:
    skrypt używa tymczasowego GLAB_CONFIG_DIR, czyści odziedziczone tokeny GitLab na czas
    sesji, prosi o token w ukrytym polu, sprawdza konto przez `glab api user` i otwiera
    podrzędną sesję PowerShell. Po `exit` przywraca wcześniejsze zmienne i usuwa katalog
    tymczasowy. Token nie trafia do argumentów procesu, historii ani pliku.

    Token jest w zmiennej GITLAB_TOKEN tej sesji, więc Codex uruchomiony w niej go widzi.
    To celowe: sandbox `elevated` na Windows działa jako inny użytkownik i nie odczyta
    tokenu glab z Menedżera poświadczeń Windows.

.EXAMPLE
    .\glab-course-session.ps1 -GitLabHost gitlab.example.com -Project grupa/projekt -MergeRequest 1
#>
param(
    [Parameter(Mandatory = $true)][string]$GitLabHost,
    [string]$Project,
    [int]$MergeRequest
)

$ErrorActionPreference = 'Stop'
$GitLabHost = ($GitLabHost -replace '^https?://', '') -replace '/.*$', ''
$glab = (Get-Command glab -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
$temporaryConfig = Join-Path ([System.IO.Path]::GetTempPath()) ('glab-course-' + [guid]::NewGuid())
$settings = @{
    GLAB_CONFIG_DIR          = $temporaryConfig
    GITLAB_HOST              = $GitLabHost
    GITLAB_API_HOST          = $GitLabHost
    GITLAB_REPO              = $null
    GLAB_API_PROTOCOL        = 'https'
    GLAB_ENABLE_CI_AUTOLOGIN = 'false'
    GLAB_DEBUG               = 'false'
    GLAB_DEBUG_HTTP          = 'false'
    GLAB_SKIP_TLS_VERIFY     = 'false'
    GLAB_CHECK_UPDATE        = 'false'
    GITLAB_TOKEN             = $null
    GITLAB_ACCESS_TOKEN      = $null
    OAUTH_TOKEN              = $null
    CI_JOB_TOKEN             = $null
    GITLAB_SUBFOLDER         = $null
    GIT_ASKPASS              = $null
    SSH_ASKPASS              = $null
    GIT_TERMINAL_PROMPT      = '1'
}
if ($Project) {
    $settings['GITLAB_REPO'] = "https://$GitLabHost/$Project"
}
$previous = @{}
foreach ($name in $settings.Keys) {
    $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}

try {
    foreach ($name in $settings.Keys) {
        [Environment]::SetEnvironmentVariable($name, $settings[$name], 'Process')
    }
    [System.IO.Directory]::CreateDirectory($temporaryConfig) | Out-Null
    $secureToken = Read-Host 'Token szkoleniowego GitLaba' -AsSecureString
    $env:GITLAB_TOKEN = [Net.NetworkCredential]::new('', $secureToken).Password
    if (-not $env:GITLAB_TOKEN) {
        throw 'Token jest pusty.'
    }
    $response = & $glab api user --hostname $GitLabHost
    if ($LASTEXITCODE -ne 0) {
        throw "glab api user zakończył się kodem $LASTEXITCODE. Sprawdź host i token."
    }
    $account = $response | ConvertFrom-Json
    Write-Host "Szkoleniowy GitLab $GitLabHost, konto $($account.username)."
    if ($Project) {
        Write-Host "Domyślny projekt: $Project."
    }
    if ($MergeRequest) {
        Write-Host 'Polecenia do ćwiczenia:'
        Write-Host "  glab mr view $MergeRequest --comments"
        Write-Host "  glab mr diff $MergeRequest"
    }
    Write-Host 'Codex uruchamiaj w tej sesji. Zamknij ją poleceniem exit.'
    & (Get-Process -Id $PID).Path -NoProfile
}
finally {
    foreach ($name in $settings.Keys) {
        [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process')
    }
    if (Test-Path -LiteralPath $temporaryConfig) {
        Remove-Item -LiteralPath $temporaryConfig -Recurse -Force
    }
}
