import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/useAuth'
import { useIsModerator } from '../../hooks/useIsModerator'
import LoginButton from '../LoginButton/LoginButton'

export default function BroadcasterRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { isBroadcaster, loading: modLoading } = useIsModerator();
  const { t } = useTranslation();

  if (authLoading || modLoading) {
    return (
      <div className="auth-loading">
        <div className="auth-spinner" />
        <p>{t('auth.loading')}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <h2>{t('auth.requiredTitle')}</h2>
        <p>{t('auth.requiredMsg')}</p>
        <div style={{ marginTop: 20 }}>
          <LoginButton />
        </div>
      </div>
    );
  }

  if (!isBroadcaster) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <h2>⛔ {t('error.title', { defaultValue: 'Zugriff verweigert' })}</h2>
        <p>{t('error.forbidden', { defaultValue: 'Diese Seite ist für dich nicht verfügbar.' })}</p>
      </div>
    );
  }

  return <>{children}</>;
}
