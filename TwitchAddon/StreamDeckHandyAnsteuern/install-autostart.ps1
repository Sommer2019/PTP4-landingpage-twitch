# Stellt sicher, dass adb (Android Platform Tools) installiert ist und
# startet anschließend ControllMobile.exe einmalig — die EXE registriert
# sich daraufhin selbst im Windows-Autostart und läuft windowless weiter.
#
# Aufruf:  powershell -ExecutionPolicy Bypass -File install-autostart.ps1

$ErrorActionPreference = 'Stop'

$scriptDir = $PSScriptRoot
$exe       = Join-Path $scriptDir 'ControllMobile.exe'

# ── adb-Check ────────────────────────────────────────────────────────────
if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
    Write-Host "adb nicht gefunden im PATH." -ForegroundColor Yellow

    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        Write-Error "winget ist nicht verfuegbar. Bitte adb (Android Platform Tools) manuell installieren: https://developer.android.com/tools/releases/platform-tools"
    }

    Write-Host "Installiere Google.PlatformTools per winget..." -ForegroundColor Cyan
    winget install --id Google.PlatformTools --exact --silent `
        --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -ne 0) {
        Write-Error "winget-Installation fehlgeschlagen (Exit-Code $LASTEXITCODE). Bitte adb manuell installieren."
    }

    # PATH der laufenden Session refreshen, damit der Re-Check unten greift.
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
                [Environment]::GetEnvironmentVariable('Path', 'User')

    if (Get-Command adb -ErrorAction SilentlyContinue) {
        Write-Host "adb erfolgreich installiert: $((Get-Command adb).Source)" -ForegroundColor Green
    } else {
        Write-Host "adb wurde installiert, ist aber in dieser Shell noch nicht im PATH. Nach naechstem Login verfuegbar." -ForegroundColor Yellow
    }
} else {
    Write-Host "adb gefunden: $((Get-Command adb).Source)" -ForegroundColor Green
}

# ── EXE einmal starten — sie traegt sich selbst in den Autostart ein ─────
if (-not (Test-Path $exe)) {
    Write-Error "ControllMobile.exe nicht gefunden unter: $exe"
}

Write-Host "Starte ControllMobile.exe (windowless) — registriert sich selbst im Autostart..." -ForegroundColor Cyan
Start-Process -FilePath $exe -WorkingDirectory $scriptDir

Write-Host ""
Write-Host "Logs landen in: $(Join-Path $scriptDir 'controll-mobile.log')"
Write-Host "Entfernen via:  powershell -File uninstall-autostart.ps1"
Write-Host "         oder:  ControllMobile.exe --uninstall"
