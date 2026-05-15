import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import './CookieBanner.css'

const STORAGE_KEY = 'cookie-consent'

/** Cookie-Consent-Banner; blendet sich aus, sobald eine Entscheidung in localStorage hinterlegt ist. */
export default function CookieBanner() {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(() => !localStorage.getItem(STORAGE_KEY))

  const handleAccept = () => {
    localStorage.setItem(STORAGE_KEY, 'accepted')
    setVisible(false)
  }

  const handleReject = () => {
    localStorage.setItem(STORAGE_KEY, 'rejected')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="cookie-banner show">
      <div className="cookie-banner-content">
        <div className="cookie-banner-text">
          {t('cookieBanner.text')}{' '}
          <a href="/datenschutz">{t('cookieBanner.privacyLink')}</a>.
        </div>
        <div className="cookie-banner-buttons">
          <button className="btn btn-accept" onClick={handleAccept}>
            {t('cookieBanner.accept')}
          </button>
          <button className="btn btn-reject" onClick={handleReject}>
            {t('cookieBanner.reject')}
          </button>
        </div>
      </div>
    </div>
  )
}


