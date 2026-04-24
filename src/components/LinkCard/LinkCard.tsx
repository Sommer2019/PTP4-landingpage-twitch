import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { LinkItem } from '../../config/siteConfig'
import { useToast } from '../../context/useToast'
import './LinkCard.css'

interface LinkCardProps {
  item: LinkItem
  onDownload?: (item: LinkItem) => void
}

export default function LinkCard({ item, onDownload }: LinkCardProps) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const isInternal = item.target === '_self' && item.url.startsWith('/')

  const handleClick = (e: React.MouseEvent) => {
    // Download: Modal öffnen statt direkt navigieren
    if (item.downloadFile && onDownload) {
      e.preventDefault()
      onDownload(item)
      return
    }

    // Discount-Code kopieren (Link wird trotzdem geöffnet)
    if (item.discountCode) {
      navigator.clipboard
        .writeText(item.discountCode)
        .then(() => showToast(t('toast.codeCopied', { code: item.discountCode })))
        .catch(() => {
          /* fallback silent */
        })
    }
  }

  const content = (
    <>
      <img src={item.icon} alt="" className="link-card-icon" />
      <div className="link-card-text">
        <strong>{t(item.titleKey)}</strong>
        {item.descKey && <span>{t(item.descKey)}</span>}
        {item.discountCode && (
          <span className="discount-code">
            {t('discountCode', { code: item.discountCode })}
          </span>
        )}
      </div>
    </>
  )

  // Use React Router for internal links
  if (isInternal) {
    return (
      <Link className="link-card" to={item.url} onClick={handleClick}>
        {content}
      </Link>
    )
  }

  return (
    <a
      className="link-card"
      href={item.url}
      target={item.target ?? '_blank'}
      rel="noopener noreferrer"
      onClick={handleClick}
    >
      {content}
    </a>
  )
}
