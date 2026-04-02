import { Link, useLocation } from 'react-router-dom'
import { FaHome } from 'react-icons/fa'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../context/useTheme.ts'
import ProfileButton from '../ProfileButton/ProfileButton.tsx'
import siteConfig from '../../config/siteConfig.ts'
import './SettingsBar.css'

const themeIcons: Record<string, string> = {
  light: '☀️',
  dark: '🌙',
  system: '💻',
}

const themeOrder = ['system', 'light', 'dark'] as const

/** Metadata for every language code we might encounter. */
const KNOWN_LANGUAGES: Record<string, { flag: string; label: string }> = {
  de:  { flag: '🇩🇪', label: 'Deutsch' },
  en:  { flag: '🇬🇧', label: 'English' },
  gsw: { flag: '🇨🇭', label: 'Schweizerdeutsch' },
}

/** Active languages configured in siteConfig (driven by VITE_LANGUAGES). */
const activeLangs = siteConfig.languages

function getCurrentLang(language: string): string {
  for (const code of activeLangs) {
    if (language?.startsWith(code)) return code
  }
  return activeLangs[0] ?? ''
}

export default function SettingsBar() {
  const { mode, setMode } = useTheme()
  const { t, i18n } = useTranslation()
  const location = useLocation()

  const cycleTheme = () => {
    const idx = themeOrder.indexOf(mode)
    setMode(themeOrder[(idx + 1) % themeOrder.length])
  }

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng)
  }

  const currentLang = getCurrentLang(i18n.language)
  const currentIdx = activeLangs.indexOf(currentLang)
  const nextLang = activeLangs[(currentIdx + 1) % activeLangs.length] ?? activeLangs[0]

  return (
    <div className="settings-bar">
      <div className="settings-left">
        <ProfileButton />
        {location.pathname !== '/' && (
          <Link to="/" className="settings-home-link" title={t('home')}>
            <FaHome size={24} />
          </Link>
        )}
      </div>
      <div className="settings-right">
        <button className="settings-btn" onClick={cycleTheme} title={t('settings.theme')}>
          {themeIcons[mode]} <span className="settings-btn-text">{t(`settings.${mode}`)}</span>
        </button>

        <select
          className="settings-select settings-select--desktop"
          value={currentLang}
          onChange={(e) => changeLanguage(e.target.value)}
          title={t('settings.language')}
        >
          {activeLangs.map((code) => {
            const meta = KNOWN_LANGUAGES[code] ?? { flag: '🌐', label: code.toUpperCase() }
            return (
              <option key={code} value={code}>
                {meta.flag} {meta.label}
              </option>
            )
          })}
        </select>

        <button
          className="settings-btn settings-lang-btn--mobile"
          onClick={() => changeLanguage(nextLang)}
          title={t('settings.language')}
        >
          {(KNOWN_LANGUAGES[currentLang] ?? { flag: '🌐' }).flag}
        </button>
      </div>
    </div>
  )
}
