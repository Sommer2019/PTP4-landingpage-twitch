/**
 * Reine Helper aus dem HTTP-Server, ausgelagert für Tests.
 * Keine Abhängigkeit zu Bun.serve, Supabase oder dem Twitch-Bot.
 */

// ── Base64URL ─────────────────────────────────────────────────────────────────

/** Dekodiert einen Base64URL-String (JWT-Variante, ohne Padding) zu Bytes. */
export function b64urlToBuffer(s: string): Uint8Array {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

/** Dekodiert einen Base64URL-String zu einem UTF-8-String. */
export function b64urlToString(s: string): string {
  return Buffer.from(b64urlToBuffer(s)).toString('utf-8')
}

// ── JWT ───────────────────────────────────────────────────────────────────────

/** Liest die numerische Twitch-User-ID aus einem JWT-Payload; null wenn nicht vorhanden oder kein String. */
export function resolveUserIdFromJwt(payload: Record<string, unknown> | null): string | null {
  const id = payload?.user_id
  return typeof id === 'string' && id ? id : null
}

// ── CORS ──────────────────────────────────────────────────────────────────────

/**
 * Baut die CORS-Header. Spiegelt nur Twitch-Origins zurück, sonst Fallback auf den
 * Extension-Supervisor — so dürfen fremde Seiten die API nicht per Browser aufrufen.
 */
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const allowed = (origin.endsWith('.twitch.tv') || origin.endsWith('.ext-twitch.tv'))
    ? origin
    : 'https://supervisor.ext-twitch.tv'
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-extension-jwt',
    Vary: 'Origin',
  }
}

// ── Query-Parameter ───────────────────────────────────────────────────────────

/** Liest einen Query-Parameter aus einer URL. */
export function queryParam(url: URL, key: string): string | null {
  return url.searchParams.get(key)
}

// ── Reward-Beschreibung & TTS ─────────────────────────────────────────────────

/**
 * Baut den Anzeigetext eines eingelösten Rewards. Bei TTS-Rewards wird je nach
 * gesetzten Feldern fester Text, Beschreibung und/oder freier Nutzertext kombiniert;
 * %name% wird durch die User-ID ersetzt.
 */
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

/**
 * Ermittelt den abzuspielenden TTS-Text. Hat der Reward einen festen Text in der DB,
 * wird kein freier Nutzertext zugelassen (null).
 */
export function resolveTts(reward: Record<string, unknown>, ttsText: string | null): string | null {
  if (!reward.istts) return null
  const text = typeof reward.text === 'string' && reward.text ? reward.text : null
  if (text) return null  // fester Text aus DB — kein freier TTS-Input
  return ttsText || null
}
