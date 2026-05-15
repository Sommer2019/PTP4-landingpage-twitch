import { useContext } from 'react'
import { AuthContext } from './authContextDef'

/** Zugriff auf den Auth-Context; nur innerhalb von AuthProvider gültig. */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

