// ──────────────────────────────────────────────────────────
//  fetch-clips.ts  –  Twitch Clip Fetch + Round 1 creation
//  Runs on the 21st of each month via GitHub Actions.
// ──────────────────────────────────────────────────────────

const TWITCH_CLIENT_ID     = process.env.TWITCH_CLIENT_ID
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET
const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TWITCH_CHANNEL       = process.env.TWITCH_CHANNEL ?? 'hd1920x1080'

if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables')
  process.exit(1)
}

// ── Types ─────────────────────────────────────────────────

interface TwitchClip {
  id: string
  title: string
  creator_name: string
  thumbnail_url: string
  embed_url: string
  url: string
  view_count: number
  duration: number
  created_at: string
}

interface VotingRound {
  id: string
  type: string
  status: string
  year: number
  month: number
}

interface DbClip {
  id: string
  twitch_clip_id: string
}

// ── Supabase helpers ──────────────────────────────────────

const SB_HEADERS = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
  'Accept-Profile': 'clipvoting',
  'Content-Profile': 'clipvoting',
}

async function sbGet<T>(table: string, query = ''): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: SB_HEADERS })
  if (!res.ok) throw new Error(`SB GET ${table}: ${res.status} ${await res.text()}`)
  return res.json() as Promise<T[]>
}

async function sbPost<T>(table: string, body: unknown): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST', headers: SB_HEADERS, body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`SB POST ${table}: ${res.status} ${await res.text()}`)
  return res.json() as Promise<T[]>
}

// ── Twitch OAuth ─────────────────────────────────────────

async function getTwitchToken(): Promise<string> {
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: TWITCH_CLIENT_ID,
      client_secret: TWITCH_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  })
  const data = await res.json() as { access_token?: string }
  if (!data.access_token) throw new Error('Failed to get Twitch token')
  return data.access_token
}

// ── Twitch API ───────────────────────────────────────────

async function getBroadcasterId(token: string): Promise<string | undefined> {
  const res = await fetch(
    `https://api.twitch.tv/helix/users?login=${TWITCH_CHANNEL}`,
    { headers: { Authorization: `Bearer ${token}`, 'Client-Id': TWITCH_CLIENT_ID } },
  )
  const data = await res.json() as { data?: { id: string }[] }
  return data.data?.[0]?.id
}

async function fetchAllClips(
  token: string,
  broadcasterId: string,
  startedAt: string,
  endedAt: string,
): Promise<TwitchClip[]> {
  const clips: TwitchClip[] = []
  let cursor = ''
  do {
    const params = new URLSearchParams({
      broadcaster_id: broadcasterId,
      started_at: startedAt,
      ended_at: endedAt,
      first: '100',
    })
    if (cursor) params.set('after', cursor)

    const res = await fetch(`https://api.twitch.tv/helix/clips?${params}`, {
      headers: { Authorization: `Bearer ${token}`, 'Client-Id': TWITCH_CLIENT_ID },
    })
    const data = await res.json() as { data?: TwitchClip[], pagination?: { cursor?: string } }
    if (!data.data) break
    clips.push(...data.data)
    cursor = data.pagination?.cursor ?? ''
  } while (cursor)

  return clips
}

// ── Discord notification ──────────────────────────────────

async function notifyDiscord(endpoint: string): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 120_000))
  try {
    const res = await fetch(`https://ptp4-landingpage-twitch-hd.onrender.com${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SUPABASE_SERVICE_ROLE_KEY,
      },
    })
    if (!res.ok) console.warn(`Discord notify ${endpoint}: ${res.status}`)
    else console.log(`Discord notified: ${endpoint}`)
  } catch (err) {
    console.warn(`Discord notify failed (${endpoint}):`, err instanceof Error ? err.message : err)
  }
}

// ── Main ─────────────────────────────────────────────────

async function main(): Promise<void> {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() + 1

  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear  = month === 1 ? year - 1 : year

  const startedAt = `${prevYear}-${String(prevMonth).padStart(2, '0')}-22T00:00:00Z`
  const endedAt   = `${year}-${String(month).padStart(2, '0')}-21T23:59:59Z`

  console.log(`Fetching clips from ${startedAt} to ${endedAt}`)

  const existing = await sbGet<{ id: string }>('voting_rounds',
    `year=eq.${year}&month=eq.${month}&type=eq.round1&select=id`)
  if (existing.length > 0) {
    console.log('Round 1 already exists for this month, skipping.')
    return
  }

  const token = await getTwitchToken()
  const broadcasterId = await getBroadcasterId(token)
  if (!broadcasterId) throw new Error(`Broadcaster "${TWITCH_CHANNEL}" not found`)

  const twitchClips = await fetchAllClips(token, broadcasterId, startedAt, endedAt)
  console.log(`Fetched ${twitchClips.length} clips from Twitch`)

  if (twitchClips.length === 0) {
    console.log('No clips found, skipping round creation.')
    return
  }

  const endsMonth = month === 12 ? 1 : month + 1
  const endsYear  = month === 12 ? year + 1 : year
  const endsAt = `${endsYear}-${String(endsMonth).padStart(2, '0')}-01T00:00:00Z`

  const [round] = await sbPost<VotingRound>('voting_rounds', {
    type: 'round1',
    status: 'active',
    year,
    month,
    starts_at: now.toISOString(),
    ends_at: endsAt,
  })
  console.log(`Created round1: ${round.id}`)

  for (const c of twitchClips) {
    try {
      const [clip] = await sbPost<DbClip>('clips', {
        twitch_clip_id: c.id,
        title: c.title,
        creator_name: c.creator_name,
        thumbnail_url: c.thumbnail_url,
        embed_url: c.embed_url,
        clip_url: c.url,
        view_count: c.view_count,
        duration: c.duration,
        twitch_created_at: c.created_at,
      })
      await sbPost('round_clips', { round_id: round.id, clip_id: clip.id })
    } catch {
      const [existing] = await sbGet<DbClip>('clips',
        `twitch_clip_id=eq.${encodeURIComponent(c.id)}&select=id`)
      if (existing) {
        try { await sbPost('round_clips', { round_id: round.id, clip_id: existing.id }) } catch { /* already linked */ }
      } else {
        console.warn(`Failed to insert clip ${c.id}`)
      }
    }
  }

  console.log(`Done – ${twitchClips.length} clips linked to round ${round.id}`)

  await notifyDiscord('/start-runde-1')
}

main().catch((err) => { console.error(err); process.exit(1) })
