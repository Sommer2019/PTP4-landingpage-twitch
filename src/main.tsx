import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n/i18n'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import { AuthProvider } from './context/AuthContext'
import { ConfirmModalProvider } from './context/ConfirmModalContext'
import App from './App.tsx'
import siteConfig from './config/siteConfig.ts'

/** Convert a CSS hex color (e.g. "#7C4DFF" or "#7c4dff") to an "R, G, B" string.
 *  Returns the fallback value if the input is not a valid hex color. */
function hexToRgb(hex: string, fallback = '124, 77, 255'): string {
  const clean = hex.replace('#', '')
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    console.warn(`[siteConfig] Invalid VITE_ACCENT_COLOR "${hex}" – using default accent color.`)
    return fallback
  }
  const r = parseInt(full.substring(0, 2), 16)
  const g = parseInt(full.substring(2, 4), 16)
  const b = parseInt(full.substring(4, 6), 16)
  return `${r}, ${g}, ${b}`
}

/** Darken each RGB channel by the given factor (0–1) to produce a darker accent shade. */
function darkenRgb(rgb: string, factor = 0.8): string {
  const [r, g, b] = rgb.split(',').map((v) => Math.round(parseInt(v.trim()) * factor))
  return `${r}, ${g}, ${b}`
}

// Inject the brand/accent color as CSS custom properties so all stylesheets
// can use var(--accent) and var(--accent-rgb) without any hardcoded hex values.
const root = document.documentElement
const accentRgb = hexToRgb(siteConfig.accentColor)
root.style.setProperty('--accent', siteConfig.accentColor)
root.style.setProperty('--accent-rgb', accentRgb)
root.style.setProperty('--accent-dark-rgb', darkenRgb(accentRgb))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <ConfirmModalProvider>
            <App />
          </ConfirmModalProvider>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
