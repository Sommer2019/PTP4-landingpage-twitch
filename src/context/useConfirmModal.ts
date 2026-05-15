import { useContext } from 'react'
import { ConfirmModalContext } from './confirmModalContextDef'

/** Zugriff auf den ConfirmModal-Context; nur innerhalb von ConfirmModalProvider gültig. */
export function useConfirmModal() {
  const ctx = useContext(ConfirmModalContext)
  if (!ctx) throw new Error('useConfirmModal must be used within ConfirmModalProvider')
  return ctx
}