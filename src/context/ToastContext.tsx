import { useCallback, useState, type ReactNode } from 'react'
import { ToastContext } from './toastContextDef'
import './Toast.css'

interface ToastItem {
  id: number
  message: string
}

let nextId = 0

/** Stellt showToast bereit und rendert kurzlebige Toast-Benachrichtigungen. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((message: string) => {
    const id = nextId++
    setToasts((prev) => [...prev, { id, message }])
    // Toast nach 2 Sekunden automatisch ausblenden
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 2000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className="toast-item">
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
