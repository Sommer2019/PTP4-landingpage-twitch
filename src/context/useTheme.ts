import { useContext } from 'react'
import { ThemeContext } from './themeContextDef'

/** Zugriff auf den Theme-Context; nur innerhalb von ThemeProvider gültig. */
export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

