import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/useAuth'
import { useToast } from '../context/useToast'
import { useClipVoting } from '../hooks/useClipVoting'
import LoginButton from '../components/LoginButton/LoginButton'
import SubPage from '../components/SubPage/SubPage'
import ClipGrid from '../components/ClipVoting/ClipGrid'
import VotingStatus from '../components/ClipVoting/VotingStatus'
import WinnerDisplay from '../components/ClipVoting/WinnerDisplay'
import YearlyStandingsDisplay from '../components/ClipVoting/YearlyStandingsDisplay'
import '../components/ClipVoting/ClipVoting.css'

/**
 * Oeffentliche Clip-Voting-Seite: zeigt je nach Voting-Phase Abstimmung,
 * Zwischenstaende oder Monats-/Jahressieger an.
 */
export default function ClipVotingPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { showToast } = useToast()
  const {
    phase,
    round,
    clips,
    userVote,
    monthlyWinner,
    yearlyWinner,
    previousYearlyWinner,
    loading,
    castVote,
  } = useClipVoting()

  const roundActive = round?.status === 'active'
  const canVote = !!user && roundActive && !userVote

  const isYearlyPhase = phase === 'yearly-active' || phase === 'yearly-results'
  const yearlyYear = round?.year ?? yearlyWinner?.year ?? new Date().getFullYear()

  async function handleVote(clipId: string) {
    const { error } = await castVote(clipId)
    if (error) {
      showToast(t(`clipVoting.error.${error}`, { defaultValue: error }))
    } else {
      showToast(t('clipVoting.voteSuccess'))
    }
  }

  if (loading) {
    return (
      <SubPage>
        <h1>{t('clipVotingPage.title')}</h1>
        <p style={{ textAlign: 'center', color: 'var(--muted)' }}>
          {t('clipVoting.loading')}
        </p>
      </SubPage>
    )
  }

  return (
    <SubPage>
      <h1>{t('clipVotingPage.title')}</h1>
      <p>{t('clipVotingPage.intro')}</p>

      {/* ── Jahressieger-Banner (nur wenn Ergebnis final) ── */}
      {yearlyWinner && phase === 'yearly-results' && (
        <WinnerDisplay type="yearly" winner={yearlyWinner} />
      )}

      {/* ── Monatssieger (zwischen Runden, nicht waehrend der Jahresphase) ── */}
      {monthlyWinner && !roundActive && !isYearlyPhase && (
        <WinnerDisplay type="monthly" winner={monthlyWinner} />
      )}

      {/* ── Status-Leiste des Votings ── */}
      {round && <VotingStatus round={round} phase={phase} />}

      {/* ── Login-Hinweis ── */}
      {!user && roundActive && (
        <div className="clip-voting__login">
          <p>{t('clipVoting.loginToVote')}</p>
          <LoginButton />
        </div>
      )}

      {/* ── Abstimmungs-Hinweis fuer eingeloggte Nutzer ── */}
      {user && roundActive && (
        <p className="clip-voting__user">
          {userVote
            ? `✅ ${t('clipVoting.alreadyVoted')}`
            : t('clipVoting.voteHint')}
        </p>
      )}

      {/* ── Yearly standings (Zwischenstand / Endstand) ── */}
      {isYearlyPhase && clips.length > 0 && (
        <YearlyStandingsDisplay
          clips={clips}
          year={yearlyYear}
          isFinal={phase === 'yearly-results'}
        />
      )}

      {/* ── Clip-Grid (Abstimmung + Embeds) — bei Jahres-Endstand ausgeblendet ── */}
      {clips.length > 0 && phase !== 'yearly-results' ? (
        <ClipGrid
          clips={clips}
          userVoteClipId={userVote}
          canVote={canVote}
          showVoteBtn={roundActive}
          showResults={!roundActive || !!userVote}
          onVote={handleVote}
        />
      ) : (
        phase === 'no-round' && (
          <p className="clip-voting__hint">{t('clipVoting.noRound')}</p>
        )
      )}

      {/* ── Vorjahressieger (immer anzeigen wenn vorhanden) ── */}
      {previousYearlyWinner && (
        <div className="previous-winner">
          <WinnerDisplay type="yearly" winner={previousYearlyWinner} />
        </div>
      )}

      {/* ── Jahressieger als „letztes Jahr" wenn keine Jahresphase aktiv ── */}
      {yearlyWinner && !isYearlyPhase && (
        <div className="previous-winner">
          <WinnerDisplay type="yearly" winner={yearlyWinner} />
        </div>
      )}
    </SubPage>
  )
}
