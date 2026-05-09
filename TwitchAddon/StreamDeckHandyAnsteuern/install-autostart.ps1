# Legt einen Verknuepfungs-Shortcut auf start-controll-mobile.vbs in den
# Windows-Autostart-Ordner des aktuellen Users. Lauft beim Login.
# Aufruf:  powershell -ExecutionPolicy Bypass -File install-autostart.ps1

$ErrorActionPreference = 'Stop'

$scriptDir   = $PSScriptRoot
$target      = Join-Path $scriptDir 'start-controll-mobile.vbs'
$startup     = [Environment]::GetFolderPath('Startup')
$shortcut    = Join-Path $startup 'ControllMobile.lnk'

if (-not (Test-Path $target)) {
    Write-Error "start-controll-mobile.vbs nicht gefunden unter: $target"
}

# ADB-Check: Bridge braucht adb im PATH. Sonst per winget Google PlatformTools installieren.
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

    if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
        Write-Host "adb wurde installiert, ist aber in dieser Shell noch nicht im PATH." -ForegroundColor Yellow
        Write-Host "Nach naechstem Login bzw. neuer PowerShell-Session sollte 'adb' auffindbar sein." -ForegroundColor Yellow
    } else {
        Write-Host "adb erfolgreich installiert: $((Get-Command adb).Source)" -ForegroundColor Green
    }
} else {
    Write-Host "adb gefunden: $((Get-Command adb).Source)" -ForegroundColor Green
}

$wsh = New-Object -ComObject WScript.Shell
$sc  = $wsh.CreateShortcut($shortcut)
$sc.TargetPath       = $target
$sc.WorkingDirectory = $scriptDir
$sc.WindowStyle      = 7   # minimiert (VBS startet eh ohne Fenster)
$sc.Description      = 'ControllMobile Bridge: Streamdeck-Trigger via redeemed_rewards'
$sc.Save()

Write-Host "Autostart-Eintrag angelegt:" -ForegroundColor Green
Write-Host "  $shortcut"
Write-Host "Ziel:"
Write-Host "  $target"
Write-Host ""
Write-Host "Test ohne Reboot:  Doppelklick auf den Shortcut oder die VBS-Datei."
Write-Host "Logs landen in:    $(Join-Path $scriptDir 'controll-mobile.log')"
