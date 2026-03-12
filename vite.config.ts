import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const ICS_SOURCE_URL =
  'https://export.kalender.digital/ics/0/4ccef74582e0eb8d7026/twitchhd1920x1080.ics?past_months=0&future_months=36'

/**
 * Vite-Plugin: stellt /api/calendar.ics bereit.
 *  • Dev-Server  → proxied die Anfrage live (kein CORS-Problem)
 *  • Production  → holt die ICS zur Build-Zeit und legt sie als statische Datei ab
 */
function calendarIcsPlugin(): Plugin {
  return {
    name: 'calendar-ics',

    /* ── Dev: Express-Middleware ── */
    configureServer(server) {
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
    },

    /* ── Build: als Asset emittieren ── */
    async generateBundle() {
      try {
        const r = await fetch(ICS_SOURCE_URL)
        const text = await r.text()
        this.emitFile({
          type: 'asset',
          fileName: 'api/calendar.ics',
          source: text,
        })
      } catch (e) {
        console.warn('[calendar-ics] Build-time fetch failed:', e)
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), calendarIcsPlugin()],
  // Für GitHub Pages mit Custom Domain (z.B. hd1920x1080.de): base: '/'
  // Für GitHub Pages OHNE Custom Domain: base: '/repo-name/'
  base: '/',
})
