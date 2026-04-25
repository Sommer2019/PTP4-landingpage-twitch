import { useTranslation } from 'react-i18next'
import { useConfirmModal } from '../../context/useConfirmModal'
import ClipEmbed from './ClipEmbed'
import type { ClipWithVotes } from '../../types/clipVoting'

interface ClipCardProps {
  clip: ClipWithVotes
  rank?: number
  isVoted: boolean
  canVote: boolean
  showVoteBtn: boolean
  showResults: boolean
  onVote: () => void
}

export default function ClipCard({
  clip,
  rank,
  isVoted,
  canVote,
  showVoteBtn,
  showResults,
  onVote,
}: ClipCardProps) {
  const { t } = useTranslation()
  const { showConfirm } = useConfirmModal()

  const handleVoteClick = async () => {
    const confirmed = await showConfirm({
      title: t('clipVoting.vote'),
      message: t('clipVoting.confirmVote'),
      confirmLabel: t('clipVoting.confirm'),
      cancelLabel: t('clipVoting.cancel'),
    })
    if (confirmed) onVote()
  }

  return (
    <div className={`clip-card${isVoted ? ' clip-card--voted' : ''}`}>
      <ClipEmbed twitchClipId={clip.twitch_clip_id} thumbnailUrl={clip.thumbnail_url} />

      <div className="clip-card__body">
        <div className="clip-card__title" title={clip.title}>
          {clip.title}
        </div>
        <div className="clip-card__creator">{clip.creator_name}</div>
        <div className="clip-card__meta">
          {rank != null && <span className="clip-card__rank">#{rank}</span>}
          {showResults && (
            <span className="clip-card__votes">
              {clip.vote_count} {t('clipVoting.votes')}
            </span>
          )}
          <span>{clip.view_count} views</span>
        </div>
      </div>

      {showVoteBtn && (
        <button
          className={`clip-card__vote-btn${isVoted ? ' clip-card__vote-btn--active' : ''}`}
          disabled={!canVote && !isVoted}
          onClick={handleVoteClick}
        >
          {isVoted ? `✓ ${t('clipVoting.voted')}` : t('clipVoting.vote')}
        </button>
      )}
    </div>
  )
}

