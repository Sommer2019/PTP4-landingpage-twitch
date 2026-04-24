import { useEffect, useState, type ReactNode } from 'react'
import { ThemeContext, type ThemeMode } from './themeContextDef'

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getInitialMode(): ThemeMode {
  const stored = localStorage.getItem('theme') as ThemeMode | null
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(getInitialMode)
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(getSystemTheme)

  // Listen to system theme changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? 'dark' : 'light')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  /** Apply resolved theme preference to document element */
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolved)
  }, [resolved])

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode)
    localStorage.setItem('theme', newMode)
  }

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode }}>
      {children}
    </ThemeContext.Provider>
  )
}
