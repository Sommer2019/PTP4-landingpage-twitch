/**
 * TwitchBot — ersetzt TwitchBot.java + TwitchOAuthUtil.java.
 * Verwendet rohen IRC-WebSocket statt Twitch4J und Bun-fetch statt OkHttp.
 *
 * Token-Strategie: kein Zeitplan — Refresh nur bei echtem 401 (auth error).
 * Damit ist der Token immer genau so lange gültig wie Twitch ihn ausstellt,
 * ohne unnötige Requests oder Drift durch feste Intervalle.
 */

import type { UserSession } from './types.ts'
import { type SupabaseClient, refreshOauthToken } from './supabase.ts'

const POINT_INTERVAL_MS = 10_000   // Timer-Check alle 10 Sekunden
const STREAM_POLL_MS    = 30_000   // Stream-Status prüfen alle 30 Sekunden

export class TwitchBot {
  private oauthToken: string
  private ws: WebSocket | null = null
  private reconnectDelay = 1_000
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pointTimer: ReturnType<typeof setInterval> | null = null
  private streamOnline = false
  private currentStreamSessionId: string | null = null

  // Verhindert parallele Refresh-Aufrufe (z.B. Polling + IRC gleichzeitig)
  private refreshPromise: Promise<void> | null = null

  private readonly sessions = new Map<string, UserSession>()

  constructor(
    oauthToken: string,
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly refreshToken: string,
    private readonly channelName: string,
    private readonly broadcasterId: string,
    private readonly supabase: SupabaseClient,
  ) {
    this.oauthToken = oauthToken
    this.startStreamPolling()
  }

  connect(): void {
    this.openIrc()
  }

  isStreamOnline(): boolean { return this.streamOnline }
  getCurrentStreamSessionId(): string | null { return this.currentStreamSessionId }
  getAllSessions(): Map<string, UserSession> { return this.sessions }

  // ── Token-Refresh bei Auth-Fehler ────────────────────────────────────────────

  /** Holt einen neuen Token. Läuft ein Refresh bereits, wird auf dessen Ergebnis gewartet. */
  private refreshOnAuthError(): Promise<void> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.doRefresh().finally(() => { this.refreshPromise = null })
    }
    return this.refreshPromise
  }

  private async doRefresh(): Promise<void> {
    console.log('[Bot] 401 empfangen — hole neuen OAuth-Token...')
    const newToken = await refreshOauthToken(this.clientId, this.clientSecret, this.refreshToken)
    if (!newToken) {
      console.error('[Bot] Token-Refresh fehlgeschlagen')
      return
    }
    this.oauthToken = newToken
    this.supabase.setTwitchCredentials(this.clientId, newToken)
    console.log('[Bot] Neuer Token erhalten — IRC wird neu verbunden')
    this.reconnectIrc()
  }

  private get bareToken(): string {
    return this.oauthToken.startsWith('oauth:') ? this.oauthToken.slice(6) : this.oauthToken
  }

  // ── IRC ──────────────────────────────────────────────────────────────────────

  private openIrc(): void {
    this.ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443')

    this.ws.onopen = () => {
      console.log('[IRC] Verbunden')
      this.reconnectDelay = 1_000
      const pass = this.oauthToken.startsWith('oauth:') ? this.oauthToken : `oauth:${this.oauthToken}`
      this.ws!.send(`PASS ${pass}`)
      this.ws!.send(`NICK ${this.channelName}`)
      this.ws!.send('CAP REQ :twitch.tv/membership')
      this.ws!.send(`JOIN #${this.channelName}`)
      console.log(`[IRC] Channel #${this.channelName} beigetreten`)
    }

    this.ws.onmessage = (event) => {
      for (const line of String(event.data).split('\r\n')) {
        if (line) this.handleLine(line)
      }
    }

    this.ws.onclose = () => {
      console.warn('[IRC] Verbindung getrennt — reconnect in', this.reconnectDelay, 'ms')
      this.scheduleReconnect()
    }

    this.ws.onerror = () => console.error('[IRC] WebSocket-Fehler')
  }

  private handleLine(line: string): void {
    if (line.startsWith('PING')) {
      this.ws?.send('PONG :tmi.twitch.tv')
      return
    }

    // Twitch meldet ungültiges Token mit NOTICE vor dem Login
    if (line.includes('Login authentication failed') || line.includes('Login unsuccessful')) {
      console.warn('[IRC] Auth fehlgeschlagen — hole neuen Token...')
      void this.refreshOnAuthError()
      return
    }

    // :username!username@username.tmi.twitch.tv JOIN #channel
    const joinMatch = line.match(/^:(\w+)!\w+@\S+ JOIN #(\S+)$/)
    if (joinMatch) {
      const [, username, channel] = joinMatch
      if (channel === this.channelName && username !== this.channelName) {
        void this.onUserJoined(username)
      }
      return
    }

    // :username!username@username.tmi.twitch.tv PART #channel
    const partMatch = line.match(/^:(\w+)!\w+@\S+ PART #(\S+)$/)
    if (partMatch) {
      const [, username, channel] = partMatch
      if (channel === this.channelName) this.onUserLeft(username)
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000)
      this.openIrc()
    }, this.reconnectDelay)
  }

  private reconnectIrc(): void {
    try { this.ws?.close() } catch { /* ignore */ }
    this.openIrc()
  }

  // ── Chat-Events ──────────────────────────────────────────────────────────────

  private async onUserJoined(username: string): Promise<void> {
    console.log('[Bot] User joined:', username)
    let userId: string | null = null
    try {
      const r = await fetch(`https://api.twitch.tv/helix/users?login=${username}`, {
        headers: { 'Client-Id': this.clientId, Authorization: `Bearer ${this.bareToken}` },
        signal: AbortSignal.timeout(10_000),
      })
      if (r.status === 401) {
        await this.refreshOnAuthError()
        // Einmal mit neuem Token wiederholen
        const retry = await fetch(`https://api.twitch.tv/helix/users?login=${username}`, {
          headers: { 'Client-Id': this.clientId, Authorization: `Bearer ${this.bareToken}` },
          signal: AbortSignal.timeout(10_000),
        })
        if (retry.ok) {
          const json = await retry.json() as { data: { id: string }[] }
          userId = json.data[0]?.id ?? null
        }
      } else if (r.ok) {
        const json = await r.json() as { data: { id: string }[] }
        userId = json.data[0]?.id ?? null
      }
    } catch (e) {
      console.error('[Bot] Fehler beim Auflösen der User-ID für', username, e)
    }

    if (!userId) {
      console.error('[Bot] Konnte User-ID für', username, 'nicht ermitteln')
      return
    }
    if (userId === this.broadcasterId) return

    this.sessions.set(username, {
      username,
      userid: userId,
      joinTimestamp: Date.now(),
      hasReceived5MinPoints: false,
      hasReceived30MinPoints: false,
      hasReceivedStayTillEndPoints: false,
    })

    if (!await this.supabase.existsUser(userId)) {
      await this.supabase.createUser(userId)
    }
  }

  private onUserLeft(username: string): void {
    console.log('[Bot] User left:', username)
    this.sessions.delete(username)
  }

  // ── Punkte-Timer ─────────────────────────────────────────────────────────────

  private startTimer(): void {
    if (this.pointTimer) return
    console.log('[Bot] Punkte-Timer gestartet')
    this.pointTimer = setInterval(() => {
      const now = Date.now()
      for (const session of this.sessions.values()) {
        const minutes = (now - session.joinTimestamp) / 60_000
        if (minutes >= 5 && !session.hasReceived5MinPoints) {
          console.log('[Bot] 5-Minuten-Punkte für', session.username)
          void this.supabase.addOrUpdatePoints(session.userid, 10, '5 Minuten')
          session.hasReceived5MinPoints = true
        }
        if (minutes >= 30 && !session.hasReceived30MinPoints) {
          console.log('[Bot] 30-Minuten-Punkte für', session.username)
          void this.supabase.addOrUpdatePoints(session.userid, 50, '30 Minuten')
          session.hasReceived30MinPoints = true
        }
      }
    }, POINT_INTERVAL_MS)
  }

  private stopTimer(): void {
    if (this.pointTimer) {
      clearInterval(this.pointTimer)
      this.pointTimer = null
      console.log('[Bot] Punkte-Timer gestoppt')
    }
  }

  // ── Stream-Status-Polling ────────────────────────────────────────────────────

  private startStreamPolling(): void {
    console.log('[Bot] Stream-Status-Polling gestartet für', this.channelName)
    setInterval(() => void this.pollStreamStatus(), STREAM_POLL_MS)
  }

  private async pollStreamStatus(): Promise<void> {
    try {
      const r = await fetch(`https://api.twitch.tv/helix/streams?user_login=${this.channelName}`, {
        headers: { 'Client-Id': this.clientId, Authorization: `Bearer ${this.bareToken}` },
        signal: AbortSignal.timeout(10_000),
      })

      if (r.status === 401) {
        console.warn('[Bot] Helix 401 beim Stream-Polling')
        await this.refreshOnAuthError()
        return  // nächster Poll-Tick läuft dann mit neuem Token
      }

      if (!r.ok) {
        console.warn('[Bot] Helix API Fehler beim Polling:', r.status)
        return
      }

      const json = await r.json() as { data: unknown[] }
      const isOnline = json.data.length > 0

      if (this.streamOnline && !isOnline) {
        console.log('[Bot] Stream OFFLINE erkannt')
        await this.handleStreamEnd()
      } else if (!this.streamOnline && isOnline) {
        console.log('[Bot] Stream ONLINE erkannt')
        await this.handleStreamStart()
      }

      this.streamOnline = isOnline
    } catch (e) {
      console.error('[Bot] Stream-Polling Fehler:', e)
    }
  }

  private async handleStreamStart(): Promise<void> {
    const identifier = `${this.channelName}-${Date.now()}`
    const sessionId = await this.supabase.createStreamSession(identifier)
    if (sessionId) {
      this.currentStreamSessionId = sessionId
      console.log('[Bot] Neue Stream-Session erstellt:', sessionId)
    }
    this.startTimer()
  }

  private async handleStreamEnd(): Promise<void> {
    for (const session of this.sessions.values()) {
      if (!session.hasReceivedStayTillEndPoints) {
        console.log('[Bot] Bis-zum-Ende-Punkte für', session.username)
        void this.supabase.addOrUpdatePoints(session.userid, 250, 'Bis zum Ende geblieben')
        session.hasReceivedStayTillEndPoints = true
      }
    }
    if (this.currentStreamSessionId) {
      await this.supabase.deactivateGlobalRedemptionsForStream(this.currentStreamSessionId)
      await this.supabase.endStreamSession(this.currentStreamSessionId)
      this.currentStreamSessionId = null
    } else {
      await this.supabase.deactivateAllActiveGlobalRedemptions()
    }
    await this.supabase.deleteAllRedeemedRewards()
    this.stopTimer()
  }
}
