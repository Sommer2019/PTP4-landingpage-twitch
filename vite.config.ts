/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Liest die Haupt-ICS-URL via Regex aus der Site-Config.
 * Bewusst Text-Parsing statt Import: siteConfig.ts ist Browser-/App-Code und
 * laesst sich nicht zuverlaessig zur Vite-Config-Ladezeit importieren.
 */
function getMainCalendarUrl(): string {
  const fallback = '';
  try {
    const configPath = path.resolve(__dirname, 'src/config/siteConfig.ts')
    if (!fs.existsSync(configPath)) return fallback
    const content = fs.readFileSync(configPath, 'utf-8')
    const streamplanBlockMatch = content.match(/streamplan:\s*{([\s\S]*?)}/)
    if (!streamplanBlockMatch) return fallback
    const block = streamplanBlockMatch[1]
    const icsUrlMatch = block.match(/icsUrl:\s*'([^']+)'/)
    if (icsUrlMatch) {
      return icsUrlMatch[1]
    }
    return fallback
  } catch (e) {
    console.warn('Could not parse siteConfig for main calendar URL:', e)
    return fallback
  }
}

const ICS_SOURCE_URL = getMainCalendarUrl()

/**
 * Lies die Site-Config (als Text), extrahiert via Regex alle Streamplan-Kategorien (ID + URL)
 * und baut daraus Proxy-Regeln (Dev) und Download-Regeln (Build).
 */
function getCategoryCalendars(): Array<{ id: number; url: string }> {
  try {
    const configPath = path.resolve(__dirname, 'src/config/siteConfig.ts')
    if (!fs.existsSync(configPath)) return []

    const content = fs.readFileSync(configPath, 'utf-8')
    const categoryBlockMatch = content.match(/categories:\s*\[([\s\S]*?)]/)
    if (!categoryBlockMatch) return []

    const block = categoryBlockMatch[1]
    const entries: Array<{ id: number; url: string }> = []

    for (const chunk of block.split('{')) {
      const idMatch = chunk.match(/id:\s*(\d+)/)
      const urlMatch = chunk.match(/url:\s*'([^']+)'/)
      if (idMatch && urlMatch) {
        entries.push({ id: Number(idMatch[1]), url: urlMatch[1] })
      }
    }

    return entries
  } catch (e) {
    console.warn('Could not parse siteConfig for calendars:', e)
    return []
  }
}

/**
 * Vite-Plugin: stellt /api/calendar.ics bereit (Main)
 * UND /api/calendar-[id].ics für alle Kategorien.
 *  • Dev-Server  → proxied die Anfrage live (kein CORS-Problem)
 *  • Production  → holt die ICS zur Build-Zeit und legt sie als statische Datei ab
 */
function calendarIcsPlugin(): Plugin {
  const categoryCalendars = getCategoryCalendars()
  console.log('[calendar-ics] Found categories:', categoryCalendars.map(c => c.id))

  return {
    name: 'calendar-ics',

    /* ── Dev: Express-Middleware ── */
    configureServer(server) {
      // 1) Main Calendar
      server.middlewares.use('/api/calendar.ics', async (_req, res) => {
        try {
          const r = await fetch(ICS_SOURCE_URL)
          const text = await r.text()
          res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
          res.setHeader('Cache-Control', 'public, max-age=300')
          res.end(text)
        } catch {
          res.statusCode = 502
          res.end('')
        }
      })

      // 2) Category Calendars
      categoryCalendars.forEach(cat => {
        server.middlewares.use(`/api/calendar-${cat.id}.ics`, async (_req, res) => {
          try {
            const r = await fetch(cat.url)
            console.log(`[DevProxy] Fetching ${cat.id} -> ${cat.url} (${r.status})`)
            const text = await r.text()
            res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
            res.setHeader('Cache-Control', 'public, max-age=300')
            res.end(text)
          } catch (err) {
            console.error(`[DevProxy] Error fetching ${cat.id}:`, err)
            res.statusCode = 502
            res.end('')
          }
        })
      })
    },

    /* ── Build: als Asset emittieren ── */
    async generateBundle() {
      // 1) Main Calendar
      try {
        const r = await fetch(ICS_SOURCE_URL)
        const text = await r.text()
        this.emitFile({
          type: 'asset',
          fileName: 'api/calendar.ics',
          source: text,
        })
      } catch (e) {
        console.warn('[calendar-ics] Build-time fetch failed (main):', e)
      }

      // 2) Category Calendars
      for (const cat of categoryCalendars) {
        try {
          console.log(`[Build] Fetching calendar for category: ${cat.id}...`)
          const r = await fetch(cat.url)
          if (!r.ok) {
            console.warn(`[calendar-ics] Build-time fetch failed (${cat.id}): Status ${r.status}`)
            continue
          }
          const text = await r.text()
          this.emitFile({
            type: 'asset',
            fileName: `api/calendar-${cat.id}.ics`,
            source: text,
          })
        } catch (e) {
          console.warn(`[calendar-ics] Build-time fetch failed (${cat.id}):`, e)
        }
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), calendarIcsPlugin()],

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/main.tsx', 'src/vite-env.d.ts'],
    },
  },
  // GitHub Pages: '/' bei Custom Domain, '/repo-name/' ohne.
  base: '/',

  build: {
    rollupOptions: {
      output: {
        // Bekannte node_modules in eigene Vendor-Chunks aufteilen, damit einzelne
        // Bundles kleiner bleiben und die "chunk is larger than"-Warnung seltener greift.
        manualChunks(id) {
          if (!id) return undefined
          // Backslashes vereinheitlichen: Rollup-IDs sind posix-artig, unter Windows
          // koennen aber Backslash-Pfade durchschlagen.
          const nid = id.split('\\').join('/')
          if (nid.includes('/node_modules/')) {
            // Pro Paket-Ordner exakt matchen, um versehentliche Teilstring-Treffer zu vermeiden.
            if (/\/node_modules\/(react|react-dom)(\/|$)/.test(nid)) return 'vendor-react'
            if (/\/(node_modules\/)(framer-motion|motion)(\/|$)/.test(nid)) return 'vendor-motion'
            if (/\/node_modules\/@supabase(\/|$)/.test(nid)) return 'vendor-supabase'
            if (/\/node_modules\/(i18next|react-i18next|i18next-browser-languagedetector)(\/|$)/.test(nid)) return 'vendor-i18n'
            if (/\/node_modules\/react-router-dom(\/|$)/.test(nid)) return 'vendor-router'
            if (/\/node_modules\/date-fns(\/|$)/.test(nid)) return 'vendor-date-fns'
            if (/\/node_modules\/react-icons(\/|$)/.test(nid)) return 'vendor-react-icons'
            if (/\/node_modules\/ical\.js(\/|$)/.test(nid)) return 'vendor-ical'

            // Kein generischer Fallback: unbekannte node_modules ueberlaesst man
            // bewusst Rollups Standard-Aufteilung.
            return undefined
          }
        },
      },
    },
  },
})
