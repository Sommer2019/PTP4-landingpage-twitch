import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/useAuth'
import './LoginButton.css'

interface LoginButtonProps {
  /** Falls gesetzt, wird dieser Text statt der Standardbeschriftung angezeigt */
  label?: string
  className?: string
}

/** Inline-Button, der den Twitch-OAuth-Login anstoesst. */
export default function LoginButton({ label, className = '' }: LoginButtonProps) {
  const { t } = useTranslation()
  const { signInWithTwitch } = useAuth()

  return (
    <button className={`btn btn-twitch-inline ${className}`} onClick={signInWithTwitch}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
      </svg>
      {label ?? t('auth.loginWithTwitch')}
    </button>
  )
}

