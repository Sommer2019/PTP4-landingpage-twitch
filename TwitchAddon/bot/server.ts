/**
 * HTTP-Server — ersetzt OverlayApiServer.java + alle *Handler.java via Bun.serve.
 * Port 8081 — alle API-Endpunkte, statische Dateien, TTS-Proxy.
 */

import { dirname, join } from 'node:path'
import type { SupabaseClient } from './supabase.ts'
import type { TwitchBot } from './twitchBot.ts'
import {
  b64urlToBuffer,
  b64urlToString,
  buildDescription,
  corsHeaders,
  queryParam,
  resolveTts,
  resolveUserIdFromJwt,
} from './serverHelpers.ts'

const PORT = 8081

// Statische Dateien liegen im kompilierten EXE neben der Binary, im Dev-Betrieb
// (bun run) im aktuellen Arbeitsverzeichnis. process.execPath zeigt im EXE auf
// die EXE selbst, im Dev-Betrieb auf das bun-Binary.
const RUNNING_AS_EXE = !/[\\/]bun(\.exe)?$/i.test(process.execPath)
const BASE_DIR = RUNNING_AS_EXE ? dirname(process.execPath) : process.cwd()

// ── JWT-Verifikation ─────────────────────────────────────────────────────────

/** Prüft die HMAC-SHA256-Signatur eines Twitch-Extension-JWT und liefert dessen Payload (oder null). */
async function verifyExtensionJwt(
  token: string,
  base64Secret: string,
): Promise<Record<string, unknown> | null> {
  try {
    const [h, p, s] = token.split('.')
    if (!h || !p || !s) return null
    const secretBytes = Buffer.from(base64Secret, 'base64')
    const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
    const valid = await crypto.subtle.verify('HMAC', key, b64urlToBuffer(s), new TextEncoder().encode(`${h}.${p}`))
    if (!valid) return null
    return JSON.parse(b64urlToString(p))
  } catch { return null }
}

function json(data: unknown, status = 200, req?: Request): Response {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (req) Object.assign(headers, corsHeaders(req))
  return new Response(JSON.stringify(data), { status, headers })
}

// ── Statische Dateien ────────────────────────────────────────────────────────

async function serveFile(filePath: string): Promise<Response> {
  const file = Bun.file(filePath)
  if (!await file.exists()) return new Response('Not Found', { status: 404 })
  return new Response(file)
}

// ── Routen-Handler ────────────────────────────────────────────────────────────

/** GET listet eingelöste Rewards (mit Anzeigenamen), DELETE entfernt einen Eintrag. */
async function handleRedeemedRewards(req: Request, supabase: SupabaseClient): Promise<Response> {
  if (req.method === 'GET') {
    return json(await supabase.getRedeemedRewardsWithUsernames(), 200, req)
  }

  if (req.method === 'DELETE') {
    const id = queryParam(new URL(req.url), 'id')
    if (!id) return json({ error: 'missing_id' }, 400, req)

    const existing = await supabase.getRedeemedRewardById(id)
    if (!existing) return json({ error: 'not_found' }, 404, req)

    const success = await supabase.deleteRedeemedReward(id)
    // Globaler Lock wird durch die Supabase-RPC gesetzt — hier kein weiterer Eintrag nötig
    return json({ success }, success ? 200 : 500, req)
  }

  return json({ error: 'method_not_allowed' }, 405, req)
}

/** Reward-CRUD. GET ist offen, Schreibzugriff nur für den Broadcaster (JWT-Rolle). */
async function handleRewards(req: Request, supabase: SupabaseClient, extensionSecret: string): Promise<Response> {
  if (req.method === 'GET') {
    return json(await supabase.getRewards(), 200, req)
  }

  // Schreibzugriff (POST/PATCH/DELETE) nur für Broadcaster
  const rawJwt = req.headers.get('x-extension-jwt')
  if (!rawJwt) return json({ error: 'missing_jwt' }, 401, req)
  const payload = await verifyExtensionJwt(rawJwt, extensionSecret)
  if (!payload || payload.role !== 'broadcaster') {
    return json({ error: 'forbidden' }, 403, req)
  }

  if (req.method === 'POST') {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null
    if (!body) return json({ error: 'invalid_body' }, 400, req)
    const created = await supabase.createReward(body)
    if (!created) return json({ error: 'create_failed' }, 500, req)
    return json(created, 201, req)
  }

  const id = queryParam(new URL(req.url), 'id')
  if (!id) return json({ error: 'missing_id' }, 400, req)

  if (req.method === 'PATCH') {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null
    if (!body) return json({ error: 'invalid_body' }, 400, req)
    const updated = await supabase.updateReward(id, body)
    if (!updated) return json({ error: 'update_failed' }, 500, req)
    return json(updated, 200, req)
  }

  if (req.method === 'DELETE') {
    const ok = await supabase.deleteReward(id)
    if (!ok) return json({ error: 'delete_failed' }, 500, req)
    return json({ success: true }, 200, req)
  }

  return json({ error: 'method_not_allowed' }, 405, req)
}

/** Liefert vorab, ob ein eingelöster Reward aktuell durch Once-per-Stream oder Cooldown blockiert ist. */
async function handleRedeemCheck(req: Request, supabase: SupabaseClient): Promise<Response> {
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, req)

  const id = queryParam(new URL(req.url), 'id')
  if (!id) return json({ error: 'missing_id' }, 400, req)

  const redeemedReward = await supabase.getRedeemedRewardById(id)
  if (!redeemedReward) return json({ error: 'not_found' }, 404, req)

  const rewardId = redeemedReward.reward_id as string

  // Once-per-stream prüfen (RPC blockiert bereits — dieser Endpunkt dient zur Statusabfrage)
  const oncePerStream = await supabase.isRewardOncePerStream(rewardId)
  if (oncePerStream && await supabase.hasActiveGlobalRedemption(rewardId, null)) {
    return json({ allowed: false, error: 'once_per_stream_active' }, 200, req)
  }

  // Globalen Cooldown prüfen
  const cooldown = await supabase.getRewardCooldown(rewardId)
  if (cooldown > 0) {
    const lastTs = await supabase.getLastGlobalRedemptionTimestamp(rewardId)
    if (lastTs > 0) {
      const elapsed = (Date.now() - lastTs) / 1000
      if (elapsed < cooldown) {
        return json({ allowed: false, error: 'cooldown_active', remaining: Math.ceil(cooldown - elapsed) }, 200, req)
      }
    }
  }

  return json({ allowed: true }, 200, req)
}

/** Löst einen Reward ein. Alle sicherheitsrelevanten Werte (User, Kosten, Text) werden serverseitig ermittelt. */
async function handleRedeem(
  req: Request,
  supabase: SupabaseClient,
  bot: TwitchBot,
  extensionSecret: string,
): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, req)

  // 1. JWT verifizieren — User-ID nur aus der Signatur lesen
  const rawJwt = req.headers.get('x-extension-jwt')
  if (!rawJwt) return json({ error: 'invalid_jwt' }, 401, req)
  const payload = await verifyExtensionJwt(rawJwt, extensionSecret)
  const twitchUserId = resolveUserIdFromJwt(payload)
  if (!twitchUserId) {
    console.warn('[Redeem] Ungültiges JWT')
    return json({ error: 'invalid_jwt' }, 401, req)
  }

  // 2. Stream-Status prüfen
  if (!bot.isStreamOnline()) {
    console.log('[Redeem] Abgelehnt — Stream offline (user=%s)', twitchUserId)
    return json({ error: 'stream_offline' }, 403, req)
  }

  // 3. Request-Body parsen
  let body: Record<string, unknown>
  try { body = await req.json() as Record<string, unknown> }
  catch { return json({ error: 'invalid_body' }, 400, req) }

  const rewardId = typeof body.reward_id === 'string' ? body.reward_id : null
  const ttsText = typeof body.tts_text === 'string' ? body.tts_text : null
  if (!rewardId) return json({ error: 'missing_reward_id' }, 400, req)

  // 4. Reward aus DB laden — maßgebliche Quelle für Kosten und Status
  const reward = await supabase.getRewardById(rewardId)
  if (!reward) return json({ error: 'reward_not_found' }, 404, req)
  if (!reward.is_enabled) return json({ error: 'reward_disabled' }, 403, req)
  const cost = typeof reward.cost === 'number' ? reward.cost : 0

  // 5. Punkte serverseitig prüfen
  const currentPoints = await supabase.getPointsByUserId(twitchUserId)
  if (currentPoints < 0) return json({ error: 'user_not_found' }, 403, req)
  if (currentPoints < cost) {
    console.log('[Redeem] Nicht genug Punkte — user=%s hat=%d braucht=%d', twitchUserId, currentPoints, cost)
    return json({ error: 'not_enough_points' }, 403, req)
  }

  // 6. Beschreibung und TTS serverseitig aufbauen
  const description = buildDescription(reward, ttsText, twitchUserId)
  const ttsToSend = resolveTts(reward, ttsText)

  // 7. RPC aufrufen
  const streamId = bot.getCurrentStreamSessionId()
  const result = await supabase.redeemRewardRpc(twitchUserId, rewardId, description, cost, ttsToSend, streamId)
  if (!result) {
    console.error('[Redeem] RPC returned null (user=%s, reward=%s)', twitchUserId, rewardId)
    return json({ error: 'rpc_error' }, 500, req)
  }

  return json(result, 200, req)
}

/** Liefert den Punktestand eines Users. */
async function handlePoints(req: Request, supabase: SupabaseClient, extensionSecret: string): Promise<Response> {
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, req)

  let userId = queryParam(new URL(req.url), 'user_id')
  if (!userId) return json({ error: 'missing_user_id' }, 400, req)

  // Opaque ID (beginnt mit "U") → echte ID aus JWT lesen
  if (userId.startsWith('U')) {
    const rawJwt = req.headers.get('x-extension-jwt')
    if (rawJwt) {
      const payload = await verifyExtensionJwt(rawJwt, extensionSecret)
      userId = resolveUserIdFromJwt(payload) ?? userId
    }
  }

  const points = await supabase.getPointsByUserId(userId)
  return json({ twitch_user_id: userId, points: Math.max(0, points), registered: points >= 0 }, 200, req)
}

/** Liefert die Punkte-Rangliste (Standardlimit 10). */
async function handleLeaderboard(req: Request, supabase: SupabaseClient): Promise<Response> {
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, req)
  const limit = parseInt(queryParam(new URL(req.url), 'limit') ?? '10', 10) || 10
  return json(await supabase.getLeaderboard(limit), 200, req)
}

/**
 * Liefert den Stream-Online-Status. Die Extension nutzt diesen Endpunkt zur
 * Offline-Anzeige; ist die EXE gar nicht erreichbar, gilt der Streamer ebenfalls
 * als offline (das wertet die Extension clientseitig aus).
 */
function handleStreamStatus(req: Request, bot: TwitchBot): Response {
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, req)
  return json({ online: bot.isStreamOnline() }, 200, req)
}

/** Proxy zum Google-Translate-TTS-Endpunkt; stellt optional den Twitch-Anzeigenamen voran. */
async function handleTts(req: Request): Promise<Response> {
  const url = new URL(req.url)
  let text = url.searchParams.get('text') ?? ''
  const twitchUserId = url.searchParams.get('twitch_user_id')

  if (!text) return new Response('Bad Request', { status: 400 })

  // Anzeigenamen voranstellen, wenn User-ID übergeben wurde
  if (twitchUserId) {
    const clientId = process.env.TWITCH_CLIENT_ID
    const token = process.env.TWITCH_OAUTH_TOKEN?.replace(/^oauth:/, '')
    if (clientId && token) {
      try {
        const r = await fetch(`https://api.twitch.tv/helix/users?id=${twitchUserId}`, {
          headers: { 'Client-Id': clientId, Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(5_000),
        })
        if (r.ok) {
          const data = await r.json() as { data: { display_name?: string }[] }
          const name = data.data[0]?.display_name
          if (name) text = `${name}: ${text}`
        }
      } catch { /* Fehler ignorieren, ohne Name weitermachen */ }
    }
  }

  const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=de&client=tw-ob&q=${encodeURIComponent(text)}`
  try {
    const r = await fetch(ttsUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },  // Google Translate benötigt einen Browser-User-Agent
      signal: AbortSignal.timeout(15_000),
    })
    if (!r.ok) return new Response(null, { status: r.status })
    return new Response(r.body, {
      status: 200,
      headers: { 'Content-Type': 'audio/mpeg', 'Access-Control-Allow-Origin': '*' },
    })
  } catch {
    return new Response(null, { status: 502 })
  }
}

// ── Server starten ───────────────────────────────────────────────────────────

/** Startet den Bun-HTTP-Server und registriert API-Routen sowie die Auslieferung statischer Dateien. */
export function startServer(supabase: SupabaseClient, bot: TwitchBot, extensionSecret: string): void {
  Bun.serve({
    port: PORT,
    async fetch(req) {
      const url = new URL(req.url)
      const path = url.pathname

      // CORS-Preflight
      if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders(req) })
      }

      // API-Routen
      if (path === '/api/redeemed_rewards') return handleRedeemedRewards(req, supabase)
      if (path === '/api/rewards')           return handleRewards(req, supabase, extensionSecret)
      if (path === '/api/redeem_check')      return handleRedeemCheck(req, supabase)
      if (path === '/api/redeem')            return handleRedeem(req, supabase, bot, extensionSecret)
      if (path === '/api/points')            return handlePoints(req, supabase, extensionSecret)
      if (path === '/api/leaderboard')       return handleLeaderboard(req, supabase)
      if (path === '/api/stream_status')     return handleStreamStatus(req, bot)
      if (path === '/api/tts')               return handleTts(req)

      // Statische Dateien
      if (path === '/overlay.html')   return serveFile(join(BASE_DIR, 'overlay.html'))
      if (path === '/tts-test.html')  return serveFile(join(BASE_DIR, 'tts-test.html'))

      if (path.startsWith('/media/')) {
        const file = path.slice('/media/'.length)
        if (file.includes('..')) return new Response('Not Found', { status: 404 })
        return serveFile(join(BASE_DIR, 'media', file))
      }

      if (path.startsWith('/extension/')) {
        const file = path.slice('/extension/'.length)
        if (file.includes('..')) return new Response('Not Found', { status: 404 })
        return serveFile(join(BASE_DIR, 'extension', file))
      }

      return new Response('Not Found', { status: 404 })
    },
  })

  console.log(`[Server] Läuft auf http://localhost:${PORT}`)
}
