/**
 * Einstiegspunkt — ersetzt Main.java.
 * Bun lädt .env automatisch, keine externe dotenv-Bibliothek nötig.
 * RAM-Ziel: < 64 MB (vs. ~350 MB JVM + Spring Boot + Twitch4J)
 */

import { SupabaseClient, refreshOauthToken, getBroadcasterId } from './bot/supabase.ts'
import { TwitchBot } from './bot/twitchBot.ts'
import { startServer } from './bot/server.ts'
import { startTunnel } from './bot/tunnel.ts'
import {
  ensureAutostartShortcut,
  removeAutostartShortcut,
  startControllMobile,
} from './bot/controllMobile.ts'

// `--uninstall` entfernt nur den Autostart-Eintrag und beendet den Prozess.
// Damit muss der Streamer nicht mehr in den Startup-Ordner navigieren.
if (process.argv.includes('--uninstall')) {
  removeAutostartShortcut()
  process.exit(0)
}

function requireEnv(key: string): string {
  const val = process.env[key]
  if (!val) {
    console.error(`[Main] Fehlende Umgebungsvariable: ${key}`)
    process.exit(1)
  }
  return val
}

async function main(): Promise<void> {
  const supabaseUrl    = requireEnv('SUPABASE_URL')
  const supabaseApiKey = requireEnv('SUPABASE_API_KEY')
  const clientId       = requireEnv('TWITCH_CLIENT_ID')
  const clientSecret   = requireEnv('TWITCH_CLIENT_SECRET')
  const refreshToken   = requireEnv('TWITCH_REFRESH_TOKEN')
  const channelName    = requireEnv('CHANNEL_NAME')
  const extensionSecret = process.env.EXTENSION_SECRET ?? ''

  let oauthToken = requireEnv('TWITCH_OAUTH_TOKEN')

  // OAuth-Token sofort erneuern, damit er garantiert frisch ist
  console.log('[Main] Erneuere OAuth-Token...')
  const freshToken = await refreshOauthToken(clientId, clientSecret, refreshToken)
  if (freshToken) {
    oauthToken = freshToken
    console.log('[Main] Neues OAuth-Token erhalten')
  } else {
    console.warn('[Main] Token-Refresh fehlgeschlagen — benutze Token aus .env')
  }

  // Broadcaster-ID ermitteln (für Punkte-Ausnahme)
  console.log('[Main] Ermittle Broadcaster-ID für', channelName)
  const broadcasterId = await getBroadcasterId(channelName, clientId, oauthToken)
  if (!broadcasterId) {
    console.error('[Main] Konnte Broadcaster-ID für', channelName, 'nicht ermitteln. Bot wird beendet.')
    process.exit(1)
  }
  console.log('[Main] Broadcaster-ID:', broadcasterId)

  const supabase = new SupabaseClient(
    supabaseUrl,
    supabaseApiKey,
    clientId,
    oauthToken,
    refreshToken,
    clientSecret,
  )

  // Broadcaster-User in DB anlegen und maximale Punkte setzen
  if (!await supabase.existsUser(broadcasterId)) {
    await supabase.createUser(broadcasterId)
  }
  await supabase.addOrUpdatePoints(broadcasterId, 2_147_483_647, 'max für broadcaster')
  console.log('[Main] Broadcaster', channelName, '(', broadcasterId, ') hat maximale Punkte')

  const bot = new TwitchBot(oauthToken, clientId, clientSecret, refreshToken, channelName, broadcasterId, supabase)
  bot.connect()

  startServer(supabase, bot, extensionSecret)
  startTunnel()

  // Handy-Bridge: Realtime-Listener für STD_ID_<n>-Rewards + ADB-Tap.
  // Optional — fehlende Konfig oder ADB stoppt den Bot nicht.
  startControllMobile(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY ?? '')

  // Autostart-Shortcut beim ersten Lauf anlegen; entfernen via `--uninstall`.
  ensureAutostartShortcut()

  console.log('[Main] Bot läuft. Punkte werden in Supabase gespeichert.')
}

main().catch((e) => {
  console.error('[Main] Fataler Fehler:', e)
  process.exit(1)
})
