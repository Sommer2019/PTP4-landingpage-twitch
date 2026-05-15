import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import siteConfig from '../config/siteConfig'
import type { LinkItem } from '../config/siteConfig'
import Hero from '../components/Hero/Hero'
import MobileToggle, { type MobileTab } from '../components/MobileToggle/MobileToggle'
import LiveSection from '../components/LiveSection/LiveSection'
import SectionBox from '../components/SectionBox/SectionBox'
import LinkCard from '../components/LinkCard/LinkCard'
import DownloadModal from '../components/DownloadModal/DownloadModal'
import Footer from '../components/Footer/Footer'

/**
 * Startseite: Hero, Live-Bereich und die aus siteConfig gespeisten Link-Sektionen.
 */
export default function HomePage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<MobileTab>('live')
  // Auf Mobile entscheidet downloadItem, ob das DownloadModal offen ist.
  const [downloadItem, setDownloadItem] = useState<LinkItem | null>(null)

  return (
    <>
      <Hero />

      <main className="landing-container" data-tab={activeTab}>
        <MobileToggle activeTab={activeTab} onTabChange={setActiveTab} />

        {/* ── Live-Bereich ── */}
        <div className="section-live">
          <LiveSection />
        </div>

        {/* ── Haupt-Links ── */}
        <div className="section-links">
          <SectionBox className="links-box">
            {siteConfig.links.map((item) => (
              <LinkCard key={item.url} item={item} />
            ))}
          </SectionBox>
        </div>

        {/* ── Games ── */}
        <div className="section-games">
          <SectionBox title={t('sections.games')}>
            {siteConfig.games.map((item) => (
              <LinkCard
                key={item.url}
                item={item}
                onDownload={item.downloadFile ? setDownloadItem : undefined}
              />
            ))}
          </SectionBox>
        </div>

        {/* ── Clips & Shorts ── */}
        <div className="section-clips">
          <SectionBox title={t('sections.clips')}>
            {siteConfig.clips.map((item) => (
              <LinkCard key={item.url} item={item} />
            ))}
          </SectionBox>
        </div>

        {/* ── Partner ── */}
        <div className="section-partners">
          <SectionBox title={t('sections.partners')}>
            {siteConfig.partners.map((item) => (
              <LinkCard key={item.url} item={item} />
            ))}
          </SectionBox>
        </div>

        <Footer />
      </main>

      <DownloadModal item={downloadItem} onClose={() => setDownloadItem(null)} />
    </>
  )
}

