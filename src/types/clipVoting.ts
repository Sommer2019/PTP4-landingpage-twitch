/* ── Typdefinitionen für das Clip-Voting ── */

export type RoundType   = 'round1' | 'round2' | 'yearly'
export type RoundStatus = 'pending' | 'active' | 'completed'

export interface VotingRound {
  id: string
  type: RoundType
  status: RoundStatus
  year: number
  month: number | null
  starts_at: string | null
  ends_at: string | null
  created_at: string
}

export interface Clip {
  id: string
  twitch_clip_id: string
  title: string
  creator_name: string
  thumbnail_url: string | null
  embed_url: string
  clip_url: string | null
  view_count: number
  duration: number
  twitch_created_at: string | null
}

export interface ClipWithVotes {
  round_id: string
  clip_id: string
  twitch_clip_id: string
  title: string
  creator_name: string
  thumbnail_url: string | null
  embed_url: string
  clip_url: string | null
  view_count: number
  duration: number
  twitch_created_at: string | null
  vote_count: number
}

export interface MonthlyWinner {
  id: string
  year: number
  month: number
  clip_id: string
  created_at: string
  clips: Clip | null
}

export interface YearlyWinner {
  id: string
  year: number
  clip_id: string
  created_at: string
  clips: Clip | null
}

/**
 * Aktuelle UI-Phase, abgeleitet aus dem Datenbankzustand.
 *
 *  loading          – Daten noch nicht geladen
 *  no-round         – nichts in der Datenbank
 *  round1-active    – Community stimmt über alle Clips ab
 *  round1-results   – Runde 1 beendet, Runde 2 ausstehend, Top 10 werden angezeigt
 *  round2-active    – Abstimmung über die Top 10
 *  round2-results   – Monatssieger feststehend
 *  yearly-active    – Abstimmung über den Clip des Jahres
 *  yearly-results   – Jahressieger feststehend
 *  between-rounds   – Wartet auf die nächste Runde 1
 */
export type VotingPhase =
  | 'loading'
  | 'no-round'
  | 'round1-active'
  | 'round1-results'
  | 'round2-active'
  | 'round2-results'
  | 'yearly-active'
  | 'yearly-results'
  | 'between-rounds'

export interface VotingState {
  phase: VotingPhase
  round: VotingRound | null
  clips: ClipWithVotes[]
  /** Clip-ID, für die der aktuelle Nutzer in dieser Runde abgestimmt hat (null falls nicht abgestimmt / nicht eingeloggt) */
  userVote: string | null
  monthlyWinner: MonthlyWinner | null
  yearlyWinner: YearlyWinner | null
  previousYearlyWinner: YearlyWinner | null
  loading: boolean
  error: string | null
}

