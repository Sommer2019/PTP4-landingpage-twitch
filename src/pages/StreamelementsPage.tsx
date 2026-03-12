import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import siteConfig from '../config/siteConfig'
import type { DonationTrigger } from '../config/siteConfig'
import SubPage from '../components/SubPage/SubPage'

export default function StreamelementsPage() {
  const { t } = useTranslation()
  const { triggers, donationUrl } = siteConfig.streamelements
  const [activeTrigger, setActiveTrigger] = useState<DonationTrigger | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  const openModal = (trigger: DonationTrigger) => {
    setActiveTrigger(trigger)
  }

  const closeModal = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    setActiveTrigger(null)
  }

  return (
    <SubPage>
      <h1>{t('streamelementsPage.title')}</h1>
      <p>{t('streamelementsPage.intro')}</p>

      <ul className="triggers-list">
        {triggers.map((trigger) => (
          <li key={trigger.id} className="trigger-item" onClick={() => openModal(trigger)}>
            <span className="price-badge">{trigger.price}</span>
            <span className="trigger-desc">{t(trigger.descKey)}</span>
          </li>
        ))}
      </ul>

      {/* Donate-Link */}
      <a
        className="se-donate-card"
        href={donationUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        <img src="/img/logos/StreamElements.png" alt="StreamElements" className="se-donate-icon" />
        <div>
          <strong>StreamElements</strong><br />
          <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
            {t('streamelementsPage.donateButton')}
          </span>
        </div>
      </a>

      {/* Audio-Detail-Modal */}
      <div
        className={`donation-modal ${activeTrigger ? 'is-open' : ''}`}
        onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
      >
        {activeTrigger && (
          <div className="donation-modal-content">
            <h2>{t(activeTrigger.descKey)}</h2>
            <p>{t(activeTrigger.textKey)}</p>
            {activeTrigger.audio && (
              <audio ref={audioRef} controls preload="none" src={activeTrigger.audio} />
            )}
            <div className="donation-modal-buttons">
              <button className="btn btn-primary" onClick={closeModal}>
                {t('streamelementsPage.close')}
              </button>
            </div>
          </div>
        )}
      </div>
    </SubPage>
  )
}
