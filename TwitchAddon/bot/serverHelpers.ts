/**
 * Reine Helper aus dem HTTP-Server, ausgelagert für Tests.
 * Keine Abhängigkeit zu Bun.serve, Supabase oder dem Twitch-Bot.
 */

// ── Base64URL ─────────────────────────────────────────────────────────────────

export function b64urlToBuffer(s: string): Uint8Array {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

export function b64urlToString(s: string): string {
  return Buffer.from(b64urlToBuffer(s)).toString('utf-8')
}

// ── JWT ───────────────────────────────────────────────────────────────────────

export function resolveUserIdFromJwt(payload: Record<string, unknown> | null): string | null {
  const id = payload?.user_id
  return typeof id === 'string' && id ? id : null
}

// ── CORS ──────────────────────────────────────────────────────────────────────

export function corsHeaders(req: Request): Record<string, string> {
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

// ── Query-Parameter ───────────────────────────────────────────────────────────

export function queryParam(url: URL, key: string): string | null {
  return url.searchParams.get(key)
}

// ── Reward-Beschreibung & TTS ─────────────────────────────────────────────────

export function buildDescription(
  reward: Record<string, unknown>,
  ttsText: string | null,
  userId: string,
): string {
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

export function resolveTts(reward: Record<string, unknown>, ttsText: string | null): string | null {
  if (!reward.istts) return null
  const text = typeof reward.text === 'string' && reward.text ? reward.text : null
  if (text) return null  // fester Text aus DB — kein freier TTS-Input
  return ttsText || null
}
