import { useContext } from 'react'
import { ToastContext } from './toastContextDef'

/** Zugriff auf den Toast-Context; nur innerhalb von ToastProvider gültig. */
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

