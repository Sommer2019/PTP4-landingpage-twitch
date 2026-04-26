import type { ReactNode } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import i18n from 'i18next'
import { initReactI18next, I18nextProvider } from 'react-i18next'
import { ToastProvider } from '../context/ToastContext'
import { ConfirmModalProvider } from '../context/ConfirmModalContext'

import en from '../i18n/locales/en.json'

// Leichtgewichtige i18n-Instanz für Tests initialisieren
if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: { en: { translation: en } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })
}

function AllProviders({ children }: { children: ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <ToastProvider>
          <ConfirmModalProvider>{children}</ConfirmModalProvider>
        </ToastProvider>
      </MemoryRouter>
    </I18nextProvider>
  )
}

function renderWithProviders(ui: ReactNode, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: AllProviders, ...options })
}

export * from '@testing-library/react'
export { renderWithProviders as render }
