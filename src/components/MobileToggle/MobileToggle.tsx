import { useTranslation } from 'react-i18next'
import './MobileToggle.css'

export type MobileTab = 'live' | 'links' | 'games'

interface MobileToggleProps {
  activeTab: MobileTab
  onTabChange: (tab: MobileTab) => void
}

const tabs: MobileTab[] = ['live', 'links', 'games']

/** Tab-Umschalter fuer die mobile Ansicht zwischen Live-, Links- und Games-Bereich. */
export default function MobileToggle({ activeTab, onTabChange }: MobileToggleProps) {
  const { t } = useTranslation()

  return (
    <div className="mobile-toggle" role="tablist" aria-label={t('mobileToggle.ariaLabel')}>
      {tabs.map((tab) => (
        <button
          key={tab}
          role="tab"
          className={activeTab === tab ? 'active' : ''}
          aria-selected={activeTab === tab}
          onClick={() => onTabChange(tab)}
        >
          {t(`mobileToggle.${tab}`)}
        </button>
      ))}
    </div>
  )
}

