import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n/i18n'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import { AuthProvider } from './context/AuthContext'
import { ConfirmModalProvider } from './context/ConfirmModalContext'
import App from './App.tsx'
import siteConfig from './config/siteConfig'

// Akzentfarbe aus siteConfig als CSS-Variablen setzen
const hex = siteConfig.accentColor.replace('#', '')
const r = parseInt(hex.substring(0, 2), 16)
const g = parseInt(hex.substring(2, 4), 16)
const b = parseInt(hex.substring(4, 6), 16)
document.documentElement.style.setProperty('--accent', siteConfig.accentColor)
document.documentElement.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`)

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
