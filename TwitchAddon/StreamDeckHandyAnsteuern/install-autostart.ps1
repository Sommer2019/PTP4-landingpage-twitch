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
