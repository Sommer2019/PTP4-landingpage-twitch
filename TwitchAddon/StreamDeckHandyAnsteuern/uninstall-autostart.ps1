# Entfernt den Autostart-Eintrag wieder.
# Aufruf:  powershell -ExecutionPolicy Bypass -File uninstall-autostart.ps1

$startup  = [Environment]::GetFolderPath('Startup')
$shortcut = Join-Path $startup 'ControllMobile.lnk'

if (Test-Path $shortcut) {
    Remove-Item $shortcut -Force
    Write-Host "Autostart-Eintrag entfernt: $shortcut" -ForegroundColor Green
} else {
    Write-Host "Kein Autostart-Eintrag vorhanden ($shortcut)."
}
