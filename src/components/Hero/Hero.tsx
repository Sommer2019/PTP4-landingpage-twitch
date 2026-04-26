import { useTranslation } from 'react-i18next'
import siteConfig from '../../config/siteConfig'
import { Mascot } from '../../config/mascotConfig'
import './Hero.css'

export default function Hero() {
  const { t } = useTranslation()
  const { profile } = siteConfig

  return (
    <header className="hero">
      <div className="hero-overlay">
        <div className="profile-box">
          <img src={profile.image} alt={profile.name} className="profile-img" />
          <div className="profile-info">
            <h1>{profile.name}</h1>
            <p>{t(profile.subtitleKey)}</p>
          </div>
          <Mascot className="hero-mascot" />
        </div>
      </div>
    </header>
  )
}

