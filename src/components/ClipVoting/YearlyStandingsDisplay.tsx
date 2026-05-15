import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ClipWithVotes } from '../../types/clipVoting'
import ClipEmbed from './ClipEmbed'

interface YearlyStandingsDisplayProps {
  clips: ClipWithVotes[]
  year: number
  isFinal: boolean
}

/** Jahres-Rangliste der Clips mit Stimmanteil-Balken; jede Zeile laesst sich zum Abspielen aufklappen. */
export default function YearlyStandingsDisplay({
  clips,
  year,
  isFinal,
}: YearlyStandingsDisplayProps) {
  const { t } = useTranslation()
  const [expandedClipId, setExpandedClipId] = useState<string | null>(null)

  if (clips.length === 0) return null

  const totalVotes = clips.reduce((sum, c) => sum + c.vote_count, 0)

  return (
    <div className="yearly-standings">
      <div className="yearly-standings__header">
        <span className="yearly-standings__trophy">🏆</span>
        <span className="yearly-standings__title">
          {isFinal
            ? t('clipVoting.yearlyStandingsFinal', { year })
            : t('clipVoting.yearlyStandingsLive', { year })}
        </span>
        {!isFinal && (
          <span className="yearly-standings__live-badge">LIVE</span>
        )}
      </div>

      <ol className="yearly-standings__list">
        {clips.map((clip, i) => {
          const rank = i + 1
          const pct = totalVotes > 0
            ? Math.round((clip.vote_count / totalVotes) * 100)
            : 0
          const isExpanded = expandedClipId === clip.clip_id

          return (
            <li
              key={clip.clip_id}
              className={`yearly-standings__item${rank === 1 ? ' yearly-standings__item--first' : ''}`}
            >
              <span className="yearly-standings__rank">#{rank}</span>

              <button
                className="yearly-standings__thumb-btn"
                onClick={() =>
                  setExpandedClipId(isExpanded ? null : clip.clip_id)
                }
                aria-label={isExpanded ? t('clipVoting.collapseClip') : t('clipVoting.expandClip')}
                title={clip.title}
              >
                {clip.thumbnail_url ? (
                  <img
                    src={clip.thumbnail_url}
                    alt=""
                    className="yearly-standings__thumb"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="yearly-standings__thumb yearly-standings__thumb--placeholder" />
                )}
                <span className="yearly-standings__thumb-icon">
                  {isExpanded ? '▲' : '▶'}
                </span>
              </button>

              <div className="yearly-standings__info">
                <div className="yearly-standings__clip-title" title={clip.title}>
                  {clip.title}
                </div>
                <div className="yearly-standings__creator">{clip.creator_name}</div>
                <div className="yearly-standings__bar-wrap">
                  <div
                    className="yearly-standings__bar"
                    style={{ width: `${pct}%` }}
                  />
                  <span className="yearly-standings__votes">
                    {clip.vote_count} {t('clipVoting.votes')} ({pct}%)
                  </span>
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      {expandedClipId && (() => {
        const clip = clips.find((c) => c.clip_id === expandedClipId)
        if (!clip) return null
        return (
          <div className="yearly-standings__embed">
            <ClipEmbed
              twitchClipId={clip.twitch_clip_id}
              thumbnailUrl={clip.thumbnail_url}
            />
          </div>
        )
      })()}
    </div>
  )
}
