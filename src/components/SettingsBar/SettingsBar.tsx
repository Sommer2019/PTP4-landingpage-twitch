import { Link, useLocation } from 'react-router-dom'
import { FaHome } from 'react-icons/fa'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../context/useTheme.ts'
import ProfileButton from '../ProfileButton/ProfileButton.tsx'
import './SettingsBar.css'

const themeIcons: Record<string, string> = {
  light: '☀️',
  dark: '🌙',
  system: '💻',
}

const themeOrder = ['system', 'light', 'dark'] as const

const languageFlags: Record<string, string> = {
  de: '🇩🇪',
  en: '🇬🇧',
  gsw: '🇨🇭',
  droggelbecher: '🥣',
}

const langOrder = ['de', 'en', 'gsw', 'droggelbecher'] as const
type Lang = (typeof langOrder)[number]

function getCurrentLang(language: string): Lang {
  if (language?.startsWith('droggelbecher')) return 'droggelbecher'
  if (language?.startsWith('gsw')) return 'gsw'
  if (language?.startsWith('de')) return 'de'
  return 'en'
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
  const nextLang = langOrder[(langOrder.indexOf(currentLang) + 1) % langOrder.length]

  return (
    <div className="settings-bar">
      <div className="settings-left">
        <ProfileButton />
        {location.pathname !== '/' && (
          <Link to="/" className="settings-home-link" title={t('home')} aria-label={t('home')}>
            <FaHome size={24} />
          </Link>
        )}
      </div>
      <div className="settings-right">
        <button className="settings-btn" onClick={cycleTheme} title={t('settings.theme')} aria-label={t('settings.theme')}>
          {themeIcons[mode]} <span className="settings-btn-text">{t(`settings.${mode}`)}</span>
        </button>

        <select
          className="settings-select settings-select--desktop"
          value={currentLang}
          onChange={(e) => changeLanguage(e.target.value)}
          title={t('settings.language')}
          aria-label={t('settings.language')}
        >
          <option value="de">🇩🇪 Deutsch</option>
          <option value="en">🇬🇧 English</option>
          <option value="gsw">🇨🇭 Schweizerdeutsch</option>
          <option value="droggelbecher">🥣 Droggelbecher</option>
        </select>

        <button
          className="settings-btn settings-lang-btn--mobile"
          onClick={() => changeLanguage(nextLang)}
          title={t('settings.language')}
          aria-label={t('settings.language')}
        >
          {languageFlags[currentLang]}
        </button>
      </div>
    </div>
  )
}
