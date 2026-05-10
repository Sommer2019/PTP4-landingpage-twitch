# Entfernt den Autostart-Eintrag wieder.
# Aufruf:  powershell -ExecutionPolicy Bypass -File uninstall-autostart.ps1
#
# Equivalent: ControllMobile.exe --uninstall

$ErrorActionPreference = 'Stop'
$scriptDir = $PSScriptRoot
$exe       = Join-Path $scriptDir 'ControllMobile.exe'

if (Test-Path $exe) {
    & $exe --uninstall
    exit $LASTEXITCODE
}

# Fallback (wenn die EXE fehlt — z.B. lokal aus Source): Shortcut direkt löschen.
$startup  = [Environment]::GetFolderPath('Startup')
$shortcut = Join-Path $startup 'ControllMobile.lnk'

if (Test-Path $shortcut) {
    Remove-Item $shortcut -Force
    Write-Host "Autostart-Eintrag entfernt: $shortcut" -ForegroundColor Green
} else {
    Write-Host "Kein Autostart-Eintrag vorhanden ($shortcut)."
}
