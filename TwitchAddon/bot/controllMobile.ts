/**
 * Handy-Bridge — lauscht per Supabase-Realtime auf neue redeemed_rewards-Einträge
 * und löst bei passendem Description-Marker (`STD_ID_<n>`) einen ADB-Tap auf einem
 * angeschlossenen Android-Gerät aus. Ohne adb installiert läuft der Rest des Bots
 * unverändert weiter — die Bridge logged dann nur einen Hinweis.
 *
 * Verwaltet zusätzlich den Windows-Autostart-Shortcut der EXE; mit `--uninstall`
 * als CLI-Argument wird der Shortcut entfernt und der Prozess beendet.
 */

import { createClient } from '@supabase/supabase-js'
import { exec, execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

const SHORTCUT_NAME = 'TwitchAddon.lnk'

// Koordinaten der sechs Tasten auf dem Streamer-Handy. Hier anpassen, wenn das
// Handy oder die Auflösung wechselt.
const buttonMapping: Record<string, { x: number; y: number }> = {
  '1': { x: 300,  y: 1000 },
  '2': { x: 300,  y: 1250 },
  '3': { x: 300,  y: 1500 },
  '4': { x: 1700, y: 1000 },
  '5': { x: 1700, y: 1250 },
  '6': { x: 1700, y: 1500 },
}

const TRIGGER_PATTERN = /^STD_ID_(\d+)$/

function getStartupDir(): string {
  return join(homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup')
}

/** Führt PowerShell mit Base64-encodiertem Command aus — vermeidet Quoting-Probleme bei Pfaden mit Leerzeichen. */
function runPowerShell(script: string): void {
  const b64 = Buffer.from(script, 'utf16le').toString('base64')
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', b64], { stdio: 'pipe' })
}

/** Legt einen Autostart-Shortcut im Windows-Startup-Ordner an, falls noch keiner existiert. */
export function ensureAutostartShortcut(): void {
  if (process.platform !== 'win32') return
  const startupDir = getStartupDir()
  const shortcutPath = join(startupDir, SHORTCUT_NAME)
  try {
    if (existsSync(shortcutPath)) return
    if (!existsSync(startupDir)) mkdirSync(startupDir, { recursive: true })
    const target = process.execPath
    const workDir = dirname(target)
    runPowerShell(
      `$ws = New-Object -ComObject WScript.Shell;` +
      `$sc = $ws.CreateShortcut('${shortcutPath.replace(/'/g, "''")}');` +
      `$sc.TargetPath = '${target.replace(/'/g, "''")}';` +
      `$sc.WorkingDirectory = '${workDir.replace(/'/g, "''")}';` +
      // WindowStyle 7 = Minimiert — Konsole stört nicht beim Boot, ist aber per Klick erreichbar.
      `$sc.WindowStyle = 7;` +
      `$sc.Description = 'TwitchAddon Bot';` +
      `$sc.Save();`,
    )
    console.log('[Autostart] Eintrag angelegt:', shortcutPath)
  } catch (e) {
    console.error('[Autostart] Konnte Shortcut nicht einrichten:', (e as Error).message ?? e)
  }
}

/** Entfernt den Autostart-Shortcut (Aufruf via `TwitchAddon.exe --uninstall`). */
export function removeAutostartShortcut(): boolean {
  if (process.platform !== 'win32') return false
  const shortcutPath = join(getStartupDir(), SHORTCUT_NAME)
  try {
    if (existsSync(shortcutPath)) {
      unlinkSync(shortcutPath)
      console.log('[Autostart] Eintrag entfernt:', shortcutPath)
      return true
    }
    console.log('[Autostart] Kein Eintrag vorhanden:', shortcutPath)
    return false
  } catch (e) {
    console.error('[Autostart] Konnte Shortcut nicht entfernen:', (e as Error).message ?? e)
    return false
  }
}

/** Sendet per ADB einen Tap auf die im buttonMapping hinterlegten Koordinaten der Taste. */
function triggerButton(buttonId: string, source: string): void {
  const coords = buttonMapping[buttonId]
  if (!coords) {
    console.warn(`[Bridge] Kein Mapping für Button ${buttonId} (Quelle: ${source})`)
    return
  }
  console.log(`[Bridge] Trigger Button ${buttonId} (${source}) → tap ${coords.x}, ${coords.y}`)
  exec(`adb shell input tap ${coords.x} ${coords.y}`, (error) => {
    if (error) console.error('[Bridge] ADB-Fehler (adb installiert? Handy verbunden?):', error.message)
  })
}

/**
 * Startet die Realtime-Bridge. Fehlende Supabase-Konfig oder fehlendes ADB
 * unterbricht den Hauptprozess (Bot/HTTP-Server/Tunnel) NICHT — die Bridge
 * ist optional und logged nur Hinweise.
 */
export function startControllMobile(supabaseUrl: string, supabaseServiceKey: string): void {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('[Bridge] SUPABASE_SERVICE_ROLE_KEY fehlt — Handy-Bridge übersprungen')
    return
  }

  // Soft-Check: Realtime auf redeemed_rewards braucht service_role wegen RLS.
  try {
    const payload = JSON.parse(Buffer.from(supabaseServiceKey.split('.')[1], 'base64').toString('utf8'))
    if (payload.role !== 'service_role') {
      console.warn(`[Bridge] Supabase-Key hat role="${payload.role}" — für Realtime auf redeemed_rewards wird service_role benötigt`)
    }
  } catch {
    console.warn('[Bridge] Supabase-Key konnte nicht dekodiert werden')
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  // Realtime explizit autorisieren — sonst nutzt der Channel in manchen
  // supabase-js-Versionen den Default-Anon-JWT und RLS blockt die Events.
  supabase.realtime.setAuth(supabaseServiceKey)

  console.log('[Bridge] Bridge gestartet, lausche auf redeemed_rewards-Events')

  supabase
    .channel('redeemed-rewards-triggers')
    .on(
      // Cast nötig: supabase-js' Channel-Typings sind hier zu eng für den generischen 'public.*'-Hook.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'postgres_changes' as any,
      { event: '*', schema: 'public', table: 'redeemed_rewards' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (payload: any) => {
        if (payload.eventType !== 'INSERT') return
        const description = typeof payload.new?.description === 'string' ? payload.new.description.trim() : ''
        if (!description) return
        const match = description.match(TRIGGER_PATTERN)
        if (!match) return
        triggerButton(match[1], `redeemed_rewards.id=${payload.new.id}`)
      },
    )
    .subscribe((status: string, err?: Error) => {
      console.log(`[Bridge] Realtime-Status: ${status}`)
      if (err) console.error('[Bridge] Realtime-Fehler:', err)
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('[Bridge] Hinweis: redeemed_rewards muss in Supabase unter Database → Replication zur Publikation supabase_realtime hinzugefügt sein.')
      }
    })
}
