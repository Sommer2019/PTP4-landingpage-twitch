import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import siteConfig from '../../config/siteConfig'
import './Footer.css'

/** Seiten-Footer mit konfigurierten Links und Copyright-Zeile des laufenden Jahres. */
export default function Footer() {
  const { t } = useTranslation()
  const year = new Date().getFullYear()

  return (
    <footer className="site-footer">
      <div className="footer-links">
        {siteConfig.footerLinks.map((link, i) => (
          <span key={link.labelKey}>
            {i > 0 && ' | '}
            <Link to={link.url}>{t(link.labelKey)}</Link>
          </span>
        ))}
      </div>
      <p>© {year} {siteConfig.copyrightHolder}</p>
    </footer>
  )
}

