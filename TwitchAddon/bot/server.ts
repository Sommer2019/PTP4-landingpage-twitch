/**
 * HTTP-Server — ersetzt OverlayApiServer.java + alle *Handler.java via Bun.serve.
 * Port 8081 — alle API-Endpunkte, statische Dateien, TTS-Proxy.
 */

import type { SupabaseClient } from './supabase.ts'
import type { TwitchBot } from './twitchBot.ts'

const PORT = 8081

// ── JWT-Verifikation ─────────────────────────────────────────────────────────

function b64urlToBuffer(s: string): Uint8Array {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

function b64urlToString(s: string): string {
  return Buffer.from(b64urlToBuffer(s)).toString('utf-8')
}

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

function resolveUserIdFromJwt(payload: Record<string, unknown> | null): string | null {
  const id = payload?.user_id
  return typeof id === 'string' && id ? id : null
}

// ── CORS ─────────────────────────────────────────────────────────────────────

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const allowed = (origin.endsWith('.twitch.tv') || origin.endsWith('.ext-twitch.tv'))
    ? origin
    : 'https://supervisor.ext-twitch.tv'
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-extension-jwt',
    Vary: 'Origin',
  }
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

// ── Query-Parameter parsen ───────────────────────────────────────────────────

function queryParam(url: URL, key: string): string | null {
  return url.searchParams.get(key)
}

// ── Routen-Handler ────────────────────────────────────────────────────────────

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

async function handleRewards(req: Request, supabase: SupabaseClient): Promise<Response> {
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, req)
  return json(await supabase.getRewards(), 200, req)
}

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

function buildDescription(reward: Record<string, unknown>, ttsText: string | null, userId: string): string {
  const isTts = Boolean(reward.istts)
  const text = typeof reward.text === 'string' && reward.text ? reward.text : null
  const desc = typeof reward.description === 'string' && reward.description ? reward.description : null

  let raw: string
  if (isTts) {
    if (text) raw = text
    else if (desc && ttsText) raw = `${desc} ${ttsText}`
    else raw = desc ?? ttsText ?? ''
  } else {
    raw = desc ?? ''
  }
  return raw.replace('%name%', userId)
}

function resolveTts(reward: Record<string, unknown>, ttsText: string | null): string | null {
  if (!reward.istts) return null
  const text = typeof reward.text === 'string' && reward.text ? reward.text : null
  if (text) return null  // fester Text aus DB — kein freier TTS-Input
  return ttsText || null
}

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

async function handleLeaderboard(req: Request, supabase: SupabaseClient): Promise<Response> {
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, req)
  const limit = parseInt(queryParam(new URL(req.url), 'limit') ?? '10', 10) || 10
  return json(await supabase.getLeaderboard(limit), 200, req)
}

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
      if (path === '/api/rewards')           return handleRewards(req, supabase)
      if (path === '/api/redeem_check')      return handleRedeemCheck(req, supabase)
      if (path === '/api/redeem')            return handleRedeem(req, supabase, bot, extensionSecret)
      if (path === '/api/points')            return handlePoints(req, supabase, extensionSecret)
      if (path === '/api/leaderboard')       return handleLeaderboard(req, supabase)
      if (path === '/api/tts')               return handleTts(req)

      // Statische Dateien
      if (path === '/overlay.html')   return serveFile('overlay.html')
      if (path === '/tts-test.html')  return serveFile('tts-test.html')

      if (path.startsWith('/media/')) {
        const file = path.slice('/media/'.length)
        return serveFile(`media/${file}`)
      }

      if (path.startsWith('/extension/')) {
        const file = path.slice('/extension/'.length)
        return serveFile(`extension/${file}`)
      }

      return new Response('Not Found', { status: 404 })
    },
  })

  console.log(`[Server] Läuft auf http://localhost:${PORT}`)
}
