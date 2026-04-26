// ──────────────────────────────────────────────────────────
//  manage-rounds.ts  –  Tägliche Runden-Lifecycle-Verwaltung
//  Manuelle Aktionen via workflow_dispatch ebenfalls möglich.
// ──────────────────────────────────────────────────────────

const SUPABASE_URL          = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ACTION                = process.env.ACTION ?? 'auto'

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Erforderliche Umgebungsvariablen fehlen')
  process.exit(1)
}

// ── Typen ─────────────────────────────────────────────────

type RoundType   = 'round1' | 'round2' | 'yearly'
type RoundStatus = 'active' | 'pending' | 'completed'

interface VotingRound {
  id: string
  type: RoundType
  status: RoundStatus
  year: number
  month: number
  starts_at?: string
  ends_at?: string
  created_at?: string
}

interface ClipVoteCount {
  clip_id: string
  vote_count: number
  view_count: number
  title?: string
}

interface MonthlyWinner {
  clip_id: string
}

interface RoundClip {
  clip_id: string
}

// ── Supabase-Hilfsfunktionen ──────────────────────────────

const HEADERS = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
  'Accept-Profile': 'clipvoting',
  'Content-Profile': 'clipvoting',
}

async function sbGet<T>(table: string, query = ''): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: HEADERS })
  if (!res.ok) throw new Error(`GET ${table}: ${res.status} ${await res.text()}`)
  return res.json() as Promise<T[]>
}

async function sbPost<T>(table: string, body: unknown): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST', headers: HEADERS, body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`POST ${table}: ${res.status} ${await res.text()}`)
  return res.json() as Promise<T[]>
}

async function sbPatch<T>(table: string, query: string, body: unknown): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: 'PATCH', headers: HEADERS, body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`PATCH ${table}: ${res.status} ${await res.text()}`)
  return res.json() as Promise<T[]>
}

async function sbDelete(table: string, query: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: 'DELETE', headers: HEADERS,
  })
  if (!res.ok) throw new Error(`DELETE ${table}: ${res.status} ${await res.text()}`)
}

// ── Discord-Benachrichtigung ────────────────────────────── TODO: URL bei Bedarf anpassen

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
    if (!res.ok) console.warn(`Discord-Benachrichtigung ${endpoint}: ${res.status}`)
    else console.log(`Discord benachrichtigt: ${endpoint}`)
  } catch (err) {
    console.warn(`Discord-Benachrichtigung fehlgeschlagen (${endpoint}):`, err instanceof Error ? err.message : err)
  }
}

// ── Top-N-Clips einer Runde nach Stimmzahl ───────────────

async function getTopClips(roundId: string, n: number): Promise<ClipVoteCount[]> {
  return sbGet<ClipVoteCount>('clip_vote_counts',
    `round_id=eq.${roundId}&order=vote_count.desc,view_count.desc&limit=${n}`)
}

// ── Runde 2 abschließen und Monatssieger ermitteln ────────

async function completeRound2(round: VotingRound): Promise<void> {
  await sbPatch('voting_rounds', `id=eq.${round.id}`, { status: 'completed' })
  console.log(`Runde 2 abgeschlossen: ${round.id}`)

  const top = await getTopClips(round.id, 1)
  if (top.length === 0) { console.log('Keine Stimmen – kein Sieger'); return }

  const winner = top[0]
  try {
    await sbPost('monthly_winners', {
      year: round.year,
      month: round.month,
      clip_id: winner.clip_id,
    })
    console.log(`Monatssieger ${round.month}/${round.year}: ${winner.title}`)
  } catch (err) {
    console.warn('Monatssieger existiert bereits oder Fehler:', err instanceof Error ? err.message : err)
  }

  notifyDiscord('/ende-runde-2')
}

// ── Alte Daten bereinigen ─────────────────────────────────

async function cleanup(): Promise<void> {
  const monthlyWinners = await sbGet<MonthlyWinner>('monthly_winners', 'select=clip_id')
  const yearlyWinners  = await sbGet<MonthlyWinner>('yearly_winners', 'select=clip_id')
  const winnerClipIds = new Set([
    ...monthlyWinners.map(w => w.clip_id),
    ...yearlyWinners.map(w => w.clip_id),
  ])

  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - 2)
  const oldRounds = await sbGet<{ id: string }>('voting_rounds',
    `status=eq.completed&created_at=lt.${cutoff.toISOString()}&select=id`)

  for (const round of oldRounds) {
    const roundClips = await sbGet<RoundClip>('round_clips',
      `round_id=eq.${round.id}&select=clip_id`)

    await sbDelete('round_clips', `round_id=eq.${round.id}`)

    for (const rc of roundClips) {
      if (winnerClipIds.has(rc.clip_id)) continue
      const otherLinks = await sbGet<{ round_id: string }>('round_clips',
        `clip_id=eq.${rc.clip_id}&select=round_id`)
      if (otherLinks.length === 0) {
        try { await sbDelete('clips', `id=eq.${rc.clip_id}`) } catch { /* ignorieren */ }
      }
    }

    await sbDelete('votes', `round_id=eq.${round.id}`)
    await sbDelete('voting_rounds', `id=eq.${round.id}`)
    console.log(`Alte Runde bereinigt: ${round.id}`)
  }
}

// ── Automatische Aktionen (täglicher Cron) ────────────────

async function runAuto(): Promise<void> {
  const now = new Date()
  const day = now.getUTCDate()

  // 1) Abgelaufene aktive Runden abschließen
  const activeRounds = await sbGet<VotingRound>('voting_rounds',
    `status=eq.active&ends_at=lte.${now.toISOString()}&order=created_at.desc`)

  for (const round of activeRounds) {
    if (round.type === 'round1') {
      await sbPatch('voting_rounds', `id=eq.${round.id}`, { status: 'completed' })
      console.log(`Runde 1 abgeschlossen: ${round.id}`)
      await notifyDiscord('/ende-runde-1')

      const top10 = await getTopClips(round.id, 10)
      if (top10.length === 0) { console.log('Keine Clips/Stimmen in Runde 1'); continue }

      const [round2] = await sbPost<VotingRound>('voting_rounds', {
        type: 'round2',
        status: 'pending',
        year: round.year,
        month: round.month,
      })
      console.log(`Ausstehende Runde 2 erstellt: ${round2.id}`)

      for (const clip of top10) {
        try { await sbPost('round_clips', { round_id: round2.id, clip_id: clip.clip_id }) } catch { /* Duplikat */ }
      }
    }

    if (round.type === 'round2') {
      await completeRound2(round)
    }

    if (round.type === 'yearly') {
      await sbPatch('voting_rounds', `id=eq.${round.id}`, { status: 'completed' })
      const top = await getTopClips(round.id, 1)
      if (top.length > 0) {
        try {
          await sbPost('yearly_winners', { year: round.year, clip_id: top[0].clip_id })
          console.log(`Jahressieger ${round.year}: ${top[0].title}`)
          notifyDiscord('/ende-jahr')
        } catch (err) { console.warn('Jahressieger-Fehler:', err instanceof Error ? err.message : err) }
      }
    }
  }

  // 2) Runde 2 am 13. automatisch starten, falls noch ausstehend
  if (day >= 13) {
    const pendingR2 = await sbGet<VotingRound>('voting_rounds',
      'status=eq.pending&type=eq.round2&order=created_at.desc&limit=1')

    if (pendingR2.length > 0) {
      const r2 = pendingR2[0]
      const endsYear = r2.month === 12 ? r2.year + 1 : r2.year
      const endsAtFixed = `${endsYear}-${String(r2.month === 12 ? 1 : r2.month + 1).padStart(2, '0')}-20T23:59:59Z`

      await sbPatch('voting_rounds', `id=eq.${r2.id}`, {
        status: 'active',
        starts_at: now.toISOString(),
        ends_at: endsAtFixed,
      })
      console.log(`Runde 2 automatisch gestartet: ${r2.id}, endet ${endsAtFixed}`)
      notifyDiscord('/start-runde-2')
    }
  }

  // 3) Nach Abschluss der November-Runde 2 → Jahres-Voting erstellen
  const novR2 = await sbGet<VotingRound>('voting_rounds',
    `type=eq.round2&status=eq.completed&month=eq.11&order=year.desc&limit=1`)

  if (novR2.length > 0) {
    const yr = novR2[0].year
    const existingYearly = await sbGet<{ id: string }>('voting_rounds',
      `type=eq.yearly&year=eq.${yr}&select=id`)

    if (existingYearly.length === 0) {
      const winners = await sbGet<MonthlyWinner>('monthly_winners',
        `or=(and(year.eq.${yr - 1},month.eq.12),and(year.eq.${yr},month.lte.11))&select=clip_id`)

      if (winners.length > 0) {
        const [yearlyRound] = await sbPost<VotingRound>('voting_rounds', {
          type: 'yearly',
          status: 'active',
          year: yr,
          starts_at: now.toISOString(),
          ends_at: `${yr}-12-20T23:59:59Z`,
        })
        for (const w of winners) {
          try { await sbPost('round_clips', { round_id: yearlyRound.id, clip_id: w.clip_id }) } catch { /* Duplikat */ }
        }
        console.log(`Jahres-Runde erstellt: ${yearlyRound.id} mit ${winners.length} Clips`)
        notifyDiscord('/start-jahr')
      }
    }
  }

  // 4) Bereinigung
  await cleanup()
}

// ── Manuelle Aktionen (workflow_dispatch) ─────────────────

async function manualStartRound2(): Promise<void> {
  const pending = await sbGet<VotingRound>('voting_rounds',
    'status=eq.pending&type=eq.round2&order=created_at.desc&limit=1')
  if (pending.length === 0) { console.log('Keine ausstehende Runde 2 gefunden'); return }

  const r2 = pending[0]
  const endsAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  await sbPatch('voting_rounds', `id=eq.${r2.id}`, {
    status: 'active',
    starts_at: new Date().toISOString(),
    ends_at: endsAt,
  })
  console.log(`Runde 2 manuell gestartet: ${r2.id}, endet ${endsAt}`)
  notifyDiscord('/start-runde-2')
}

async function manualEndRound2(): Promise<void> {
  const active = await sbGet<VotingRound>('voting_rounds',
    'status=eq.active&type=eq.round2&order=created_at.desc&limit=1')
  if (active.length === 0) { console.log('Keine aktive Runde 2 gefunden'); return }
  await completeRound2(active[0])
  // notifyDiscord('/ende-runde-2') wird bereits in completeRound2() aufgerufen
}

async function manualStartYearly(): Promise<void> {
  const now = new Date()
  const currentYear = now.getUTCFullYear()

  const existing = await sbGet<{ id: string }>('voting_rounds',
    `type=eq.yearly&year=eq.${currentYear}&select=id`)
  if (existing.length > 0) { console.log('Jahres-Runde existiert bereits'); return }

  const winners = await sbGet<MonthlyWinner>('monthly_winners',
    `or=(and(year.eq.${currentYear - 1},month.eq.12),and(year.eq.${currentYear},month.lte.11))&select=clip_id`)

  if (winners.length === 0) { console.log('Keine Monatssieger gefunden'); return }

  const endsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const [yearlyRound] = await sbPost<VotingRound>('voting_rounds', {
    type: 'yearly',
    status: 'active',
    year: currentYear,
    starts_at: now.toISOString(),
    ends_at: endsAt,
  })
  for (const w of winners) {
    try { await sbPost('round_clips', { round_id: yearlyRound.id, clip_id: w.clip_id }) } catch { /* Duplikat */ }
  }
  console.log(`Jahres-Runde erstellt: ${yearlyRound.id} mit ${winners.length} Clips`)
  notifyDiscord('/start-jahr')
}

async function manualEndYearly(): Promise<void> {
  const active = await sbGet<VotingRound>('voting_rounds',
    'status=eq.active&type=eq.yearly&order=created_at.desc&limit=1')
  if (active.length === 0) { console.log('Keine aktive Jahres-Runde gefunden'); return }

  const round = active[0]
  await sbPatch('voting_rounds', `id=eq.${round.id}`, { status: 'completed' })
  const top = await getTopClips(round.id, 1)
  if (top.length > 0) {
    try {
      await sbPost('yearly_winners', { year: round.year, clip_id: top[0].clip_id })
      console.log(`Jahressieger ${round.year}: ${top[0].title}`)
      notifyDiscord('/ende-jahr')
    } catch (err) { console.warn('Jahressieger-Fehler:', err instanceof Error ? err.message : err) }
  }
}

// ── Einstiegspunkt ───────────────────────────────────────

async function main(): Promise<void> {
  console.log(`Aktion: ${ACTION}`)

  switch (ACTION) {
    case 'start_round2': await manualStartRound2(); break
    case 'end_round2':   await manualEndRound2(); break
    case 'start_yearly': await manualStartYearly(); break
    case 'end_yearly':   await manualEndYearly(); break
    default:             await runAuto(); break
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
