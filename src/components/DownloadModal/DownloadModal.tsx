import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { LinkItem } from '../../config/siteConfig'
import { useToast } from '../../context/useToast'
import './DownloadModal.css'

interface DownloadModalProps {
  item: LinkItem | null
  onClose: () => void
}

/** Bestaetigungsdialog vor einem Datei-Download; loest bei Zustimmung den Download aus. */
export default function DownloadModal({ item, onClose }: DownloadModalProps) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const [closing, setClosing] = useState(false)

  if (!item) return null

  const handleClose = () => {
    // Schliessen erst nach der CSS-Ausblendanimation melden (180ms muss zur .is-closing-Transition passen)
    setClosing(true)
    setTimeout(() => {
      setClosing(false)
      onClose()
    }, 180)
  }

  const handleConfirm = () => {
    if (item.downloadFile) {
      const a = document.createElement('a')
      a.href = item.downloadFile
      a.download = item.downloadName ?? 'download'
      document.body.appendChild(a)
      a.click()
      a.remove()
      showToast(t('toast.downloadStarted'))
    }
    handleClose()
  }

  return (
    <div
      className={`download-modal is-open ${closing ? 'is-closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="download-modal-title"
    >
      <div className="modal-backdrop" onClick={handleClose} />
      <div className="modal-card">
        <h3 className="modal-title" id="download-modal-title">{t('downloadModal.title')}</h3>
        <p className="modal-message">
          {t('downloadModal.message')} <strong>{item.downloadName}</strong>
        </p>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={handleClose}>
            {t('downloadModal.cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={handleConfirm}>
            {t('downloadModal.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}


