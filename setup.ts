/**
 * Twitch Landing Page – Interaktiver Setup-Assistent
 * Führt Basis-Konfiguration durch und gibt klare Folgeschritte aus.
 * Ausführen mit:  npx tsx setup.ts
 */

import { createInterface } from 'readline'
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, rmSync, renameSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { execSync } from 'child_process'

// Wird beim CI-Build via `bun build --define` eingebacken.
// Beispiel: https://github.com/<owner>/<repo>/archive/refs/heads/master.zip
const REPO_ZIP_URL = process.env.SETUP_REPO_ZIP_URL ?? ''

// Im kompilierten EXE zeigt import.meta.url auf Bun's virtuelles Dateisystem
// (z.B. B:\~BUN\root\setup.ts) — dort gibt es die Projekt-Files nicht. Stattdessen
// nehmen wir process.cwd(): der User führt setup.exe ja im Projekt-Wurzelverzeichnis aus.
// Im Dev-Betrieb (bun run / tsx) zeigt process.execPath auf das bun- bzw. node-Binary.
const COMPILED_EXE = !/[\\/](bun|node|tsx)(\.exe)?$/i.test(process.execPath)
const __dir = COMPILED_EXE ? process.cwd() : dirname(fileURLToPath(import.meta.url))
const rl = createInterface({ input: process.stdin, output: process.stdout })

/** Stellt eine Frage auf der Konsole; leere Eingabe faellt auf den Default zurueck. */
function ask(question: string, def = ''): Promise<string> {
  return new Promise(resolve => {
    const hint = def ? ` [${def}]` : ''
    rl.question(`  ${question}${hint}: `, answer => {
      resolve(answer.trim() || def)
    })
  })
}

/**
 * Lädt das Repo als ZIP von GitHub und entpackt es ins Zielverzeichnis.
 * Nutzt Windows-`tar.exe` (seit Windows 10 1803 enthalten) mit PowerShell
 * `Expand-Archive` als Fallback. GitHub-Archive haben einen einzelnen
 * Top-Folder (`<repo>-<branch>/`); dessen Inhalt wird hochgehoben.
 */
async function downloadRepo(dir: string): Promise<void> {
  if (!REPO_ZIP_URL) {
    console.error('  ❌ Keine Repo-URL eingebacken. Beim Build muss SETUP_REPO_ZIP_URL gesetzt sein.')
    process.exit(1)
  }

  // Schutz gegen versehentliches Überschreiben: Ordner muss leer sein (außer EXE/Setup-Tempfiles).
  const items = readdirSync(dir).filter(f => f !== 'setup.exe' && !f.startsWith('.setup'))
  if (items.length > 0) {
    console.log('  ⚠️  Aktueller Ordner ist nicht leer:')
    console.log('     ' + items.slice(0, 5).join(', ') + (items.length > 5 ? ` … (+${items.length - 5})` : ''))
    const ok = await ask('Trotzdem entpacken? (j/N)', 'n')
    if (!/^j(a)?$/i.test(ok)) { console.log('  Abgebrochen.'); process.exit(0) }
  }

  console.log('\n  ⬇️  Lade Repo-ZIP von', REPO_ZIP_URL)
  const res = await fetch(REPO_ZIP_URL)
  if (!res.ok) {
    console.error('  ❌ Download fehlgeschlagen: HTTP', res.status)
    process.exit(1)
  }
  const buf = Buffer.from(await res.arrayBuffer())

  const tmpZip = join(dir, '.setup-repo.zip')
  const tmpExtract = join(dir, '.setup-extract')
  writeFileSync(tmpZip, buf)
  if (existsSync(tmpExtract)) rmSync(tmpExtract, { recursive: true, force: true })
  mkdirSync(tmpExtract)

  console.log('  📦 Entpacke (' + Math.round(buf.length / 1024) + ' KB)...')
  try {
    execSync(`tar -xf "${tmpZip}" -C "${tmpExtract}"`, { stdio: 'pipe' })
  } catch {
    // Fallback für ältere Windows ohne tar.exe
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${tmpZip}' -DestinationPath '${tmpExtract}' -Force"`,
      { stdio: 'pipe' },
    )
  }

  const roots = readdirSync(tmpExtract)
  if (roots.length !== 1) {
    rmSync(tmpExtract, { recursive: true, force: true })
    rmSync(tmpZip)
    throw new Error(`Unerwartete ZIP-Struktur (${roots.length} Top-Level-Einträge)`)
  }
  const repoRoot = join(tmpExtract, roots[0])
  for (const item of readdirSync(repoRoot)) {
    renameSync(join(repoRoot, item), join(dir, item))
  }

  rmSync(tmpExtract, { recursive: true, force: true })
  rmSync(tmpZip)
  console.log('  ✅ Repo entpackt nach', dir, '\n')
}

/**
 * Stellt sicher, dass das Repo lokal vorhanden ist: wenn `src/config/siteConfig.ts`
 * schon existiert, gilt der Ordner als „bereit", sonst wird das ZIP gezogen.
 */
async function bootstrap(dir: string): Promise<void> {
  if (existsSync(join(dir, 'src', 'config', 'siteConfig.ts'))) {
    console.log('  ℹ️  Repo bereits im Ordner gefunden — überspringe Download.\n')
    return
  }
  await downloadRepo(dir)
}

/** Ersetzt das erste Vorkommen; warnt statt zu werfen, falls das Muster fehlt. */
function replace(text: string, search: string, replacement: string): string {
  if (!text.includes(search)) {
    console.warn(`    ⚠  Muster nicht gefunden: ${search.slice(0, 60)}`)
    return text
  }
  return text.replace(search, replacement)
}

/** Fragt alle Setup-Werte ab und schreibt siteConfig, Sprachdateien und .env. */
async function main(): Promise<void> {
  console.log('\n┌─────────────────────────────────────────────────────────┐')
  console.log('│  🛠️   Twitch Landing Page – Setup-Assistent              │')
  console.log('└─────────────────────────────────────────────────────────┘')

  await bootstrap(__dir)

  console.log('Beantworte die folgenden Fragen. [Wert in Klammern] = Standard.\n')

  // ── Eingaben ──────────────────────────────────────────────────────────────
  const channelName    = await ask('Twitch-Kanalname (Kleinbuchstaben, z.B. meinkanal)')
  const displayName    = await ask('Anzeigename (z.B. MeinKanal)')
  const heroSubtitle   = await ask('Tagline / Untertitel (z.B. Gaming, Streams & Clips)')
  const accentColor    = await ask('Akzentfarbe (Hex)', '#7C4DFF')
  const premiumName    = await ask('Name des Premium-Bereichs (wie "OnlyBart")', 'OnlyBart')

  console.log('\n  — Impressum —')
  const iName    = await ask('Vollständiger Name (Pflicht lt. TMG)')
  const iCompany = await ask('Firma / Unternehmen (leer = keins)', '')
  const iStreet  = await ask('Straße + Hausnummer')
  const iCity    = await ask('PLZ + Ort')
  const iEmail   = await ask('E-Mail-Adresse')

  const copyright      = await ask('Copyright-Inhaber', iCompany || displayName)
  const streamElemsUrl = await ask('StreamElements Donation-URL (leer = später)', '')
  const calendarUrl    = await ask('kalender.digital Haupt-ICS-URL (leer = später)', '')

  rl.close()

  // ── siteConfig.ts ─────────────────────────────────────────────────────────
  const configPath = join(__dir, 'src/config/siteConfig.ts')
  let cfg = readFileSync(configPath, 'utf-8')

  cfg = replace(cfg, `name: 'HD1920x1080',`,               `name: '${displayName}',`)
  cfg = replace(cfg, `name: 'Stefan Slapnik',`,             `name: '${iName}',`)
  cfg = replace(cfg, `company: 'FullHD Media',`,            `company: '${iCompany}',`)
  cfg = replace(cfg, `street: 'Kolpingstraße 9',`,          `street: '${iStreet}',`)
  cfg = replace(cfg, `city: '95615 Marktredwitz',`,         `city: '${iCity}',`)
  cfg = replace(cfg, `email: 'Admin@HD1920x1080.de',`,      `email: '${iEmail}',`)
  cfg = replace(cfg, `copyrightHolder: 'FullHD Media',`,    `copyrightHolder: '${copyright}',`)
  cfg = replace(cfg, `accentColor: '#7C4DFF',`,             `accentColor: '${accentColor}',`)
  cfg = replace(cfg, `title: 'OnlyBart',`,                  `title: '${premiumName}',`)

  if (streamElemsUrl)
    cfg = replace(cfg,
      `donationUrl: 'https://streamelements.com/hd1920x1080-5003/tip',`,
      `donationUrl: '${streamElemsUrl}',`)

  if (calendarUrl)
    cfg = replace(cfg,
      `icsUrl: 'https://export.kalender.digital/ics/0/4ccef74582e0eb8d7026/twitchhd1920x1080.ics',`,
      `icsUrl: '${calendarUrl}',`)

  writeFileSync(configPath, cfg, 'utf-8')
  console.log('\n  ✅ src/config/siteConfig.ts aktualisiert')

  // ── Sprachdateien ─────────────────────────────────────────────────────────
  for (const locale of ['de', 'en', 'gsw']) {
    const p = join(__dir, `src/i18n/locales/${locale}.json`)
    if (!existsSync(p)) continue
    let json = readFileSync(p, 'utf-8')
    json = json.replace(
      `"subtitle": "FullHD – Gaming, Streams & Clips"`,
      `"subtitle": "${heroSubtitle}"`
    )
    writeFileSync(p, json, 'utf-8')
  }
  console.log('  ✅ Sprachdateien (de/en/gsw.json) aktualisiert')

  // ── .env ──────────────────────────────────────────────────────────────────
  const envPath = join(__dir, '.env')
  if (!existsSync(envPath)) {
    writeFileSync(envPath,
`# Supabase – nach Schritt 5 ausfüllen
VITE_SUPABASE_URL=https://dein-projekt.supabase.co
VITE_SUPABASE_ANON_KEY=

# Twitch – nach Schritt 4 ausfüllen
VITE_TWITCH_CLIENT_ID=
VITE_CHANNEL_NAME=${channelName}
`, 'utf-8')
    console.log('  ✅ .env erstellt (Supabase- und Twitch-Werte noch eintragen)')
  } else {
    console.log('  ℹ️  .env existiert bereits – nicht verändert')
  }

  // ── Folgeschritte ─────────────────────────────────────────────────────────
  console.log(`
┌─────────────────────────────────────────────────────────┐
│  ✅ Basis-Konfiguration abgeschlossen!                    │
└─────────────────────────────────────────────────────────┘

📋  Was jetzt noch zu tun ist (in Reihenfolge):

  1. BILDER ersetzen
     public/img/logos/HDProfile.webp   → dein Profilbild
     public/img/logos/OB.webp          → dein Premium-Logo
     public/img/logo128.png            → Favicon/App-Icon

  2. LINKS anpassen  →  src/config/siteConfig.ts
     • links[]      Hauptlinks (URLs, Icons, Ziele)
     • games[]      Spiel-Links
     • clips[]      Clip-/Shorts-Links
     • partners[]   Partnerlinks + Rabattcodes
     • redirects{}  Kurz-URLs

  3. STREAMPLAN konfigurieren  →  siteConfig.ts → streamplan
     • icsUrl       Haupt-Kalender-URL von kalender.digital
     • categories[] Kategorien + Farben + ICS-URLs

  4. TWITCH APP erstellen  →  dev.twitch.tv/console/apps
     → Anleitung: SETUP.md, Schritt 4

  5. SUPABASE einrichten  →  supabase.com
     → Anleitung: SETUP.md, Schritt 5

  6. GITHUB SECRETS eintragen  →  Repo → Settings → Secrets → Actions
     → Anleitung: SETUP.md, Schritt 6

  7. GITHUB PAGES aktivieren
     → Repo → Settings → Pages → Source: "GitHub Actions"

  8. (Optional) TWITCHADDON (Kanalpunkte-Bot)
     → Anleitung: TwitchAddon/SETUP.md

  9. (Optional) DISCORD BOT
     → Anleitung: SETUP.md, Anhang C

📖  Vollständige Anleitung: SETUP.md
`)
}

main().catch((err: unknown) => { console.error(err); process.exit(1) })
