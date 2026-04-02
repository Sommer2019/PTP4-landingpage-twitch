import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import siteConfig from '../config/siteConfig'

// Auto-discover all locale JSON files under ./locales/.
// To add a new language: create src/i18n/locales/<code>.json and list its
// code in VITE_LANGUAGES (or in siteConfig.languages).
const localeModules = import.meta.glob('./locales/*.json', { eager: true, import: 'default' }) as Record<string, Record<string, unknown>>

const activeLangs = siteConfig.languages

const resources: Record<string, { translation: Record<string, unknown> }> = {}
for (const [path, translations] of Object.entries(localeModules)) {
  const code = path.replace('./locales/', '').replace('.json', '')
  if (activeLangs.includes(code)) {
    resources[code] = { translation: translations }
  }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: activeLangs[0] ?? 'de',
    supportedLngs: activeLangs,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'language',
      caches: ['localStorage'],
    },
  })

export default i18n

