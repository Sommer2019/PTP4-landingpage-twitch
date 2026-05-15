/**
 * ngrok-Tunnel — macht den lokalen HTTP-Server (Port 8081) über eine feste,
 * öffentliche HTTPS-Domain erreichbar. Twitch verlangt eine gleichbleibende
 * Domain auf der Fetch-Allowlist der Extension, daher reicht kein Quick-Tunnel.
 *
 * Domain und Authtoken werden beim CI-Build als String-Konstanten in die EXE
 * eingebacken (siehe pipeline.yml), sodass der Streamer nichts einrichten muss.
 * Im Dev-Betrieb stammen sie aus der .env; fehlen sie, läuft der Server nur lokal.
 */

import { dirname, join } from 'node:path'

const PORT = 8081
const MAX_RESTART_DELAY_MS = 30_000

/** Pfad zur ngrok-Binary: im kompilierten EXE liegt sie daneben, im Dev-Betrieb wird der PATH genutzt. */
async function resolveNgrokBinary(): Promise<string> {
  const exeName = process.platform === 'win32' ? 'ngrok.exe' : 'ngrok'
  const bundled = join(dirname(process.execPath), exeName)
  if (await Bun.file(bundled).exists()) return bundled
  return 'ngrok'
}

let restartDelay = 1_000

/** Startet ngrok als Kindprozess und verbindet ihn bei jedem Beenden mit wachsendem Backoff neu. */
async function spawnNgrok(domain: string, authtoken: string): Promise<void> {
  const bin = await resolveNgrokBinary()

  let proc: Bun.Subprocess<'ignore', 'pipe', 'pipe'>
  try {
    proc = Bun.spawn(
      [bin, 'http', `--domain=${domain}`, String(PORT), '--log=stdout', '--log-format=logfmt'],
      { env: { ...process.env, NGROK_AUTHTOKEN: authtoken }, stdout: 'pipe', stderr: 'pipe' },
    )
  } catch (e) {
    console.error('[Tunnel] ngrok konnte nicht gestartet werden:', e)
    return
  }

  // stdout nach der öffentlichen URL durchsuchen, um sie einmalig zu loggen.
  // Eine erfolgreich gemeldete URL bedeutet, dass der Tunnel steht — Backoff zurücksetzen.
  void (async () => {
    const decoder = new TextDecoder()
    for await (const chunk of proc.stdout) {
      const match = decoder.decode(chunk).match(/url=(https:\/\/\S+)/)
      if (match) {
        restartDelay = 1_000
        console.log('[Tunnel] Öffentlich erreichbar unter', match[1])
      }
    }
  })()

  const code = await proc.exited
  console.warn(`[Tunnel] ngrok beendet (code=${code}) — Neustart in ${restartDelay} ms`)
  setTimeout(() => void spawnNgrok(domain, authtoken), restartDelay)
  restartDelay = Math.min(restartDelay * 2, MAX_RESTART_DELAY_MS)
}

/**
 * Startet den ngrok-Tunnel. Ohne NGROK_DOMAIN/NGROK_AUTHTOKEN wird übersprungen —
 * der Server ist dann nur unter http://localhost:8081 erreichbar (Dev-Betrieb).
 */
export function startTunnel(): void {
  const domain = process.env.NGROK_DOMAIN
  const authtoken = process.env.NGROK_AUTHTOKEN
  if (!domain || !authtoken) {
    console.warn('[Tunnel] NGROK_DOMAIN/NGROK_AUTHTOKEN nicht gesetzt — Tunnel übersprungen, Server nur über localhost erreichbar')
    return
  }
  console.log('[Tunnel] Starte ngrok-Tunnel für Domain', domain)
  void spawnNgrok(domain, authtoken)
}
