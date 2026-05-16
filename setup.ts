/**
 * Twitch Landing Page – Interaktiver Setup-Assistent
 *
 * Führt durch die komplette Erstinstallation:
 *   1. Grunddaten (Kanal, Profil, Impressum, Akzentfarbe)
 *   2. Interaktive Listen (Links, Games, Clips, Partner, Redirects, Streamplan-Kategorien)
 *   3. Twitch-App + Supabase Walkthrough
 *   4. GitHub-Repo + Secrets + Pages (per `gh` CLI, mit Winget-Install-Fallback)
 *   5. Optional: TwitchAddon (ngrok+Extension), Discord-Bot
 *   6. Bilder-Check (welche Default-Dateien musst du noch ersetzen?)
 *
 * Ausführen mit:  npx tsx setup.ts   oder   .\setup.exe
 */

import { createInterface } from 'readline'
import {
  readFileSync, writeFileSync, existsSync, readdirSync,
  mkdirSync, rmSync, renameSync,
} from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { execSync } from 'child_process'

// Wird beim CI-Build via `bun build --define` eingebacken.
const REPO_ZIP_URL = process.env.SETUP_REPO_ZIP_URL ?? ''

// Im kompilierten EXE zeigt import.meta.url auf Bun's virtuelles Dateisystem;
// stattdessen process.cwd() nehmen (User startet setup.exe im Projekt-Root).
const COMPILED_EXE = !/[\\/](bun|node|tsx)(\.exe)?$/i.test(process.execPath)
const __dir = COMPILED_EXE ? process.cwd() : dirname(fileURLToPath(import.meta.url))
const rl = createInterface({ input: process.stdin, output: process.stdout })

// ─── Sammelt am Ende, was erledigt/offen ist ─────────────────────────────────
const summary = {
  done: [] as string[],
  remaining: [] as string[],
}

// ═════════════════════════════════════════════════════════════════════════════
// PROMPT-HELFER
// ═════════════════════════════════════════════════════════════════════════════

function ask(question: string, def = ''): Promise<string> {
  return new Promise(resolve => {
    const hint = def ? ` [${def}]` : ''
    rl.question(`  ${question}${hint}: `, answer => resolve(answer.trim() || def))
  })
}

async function askYesNo(question: string, def = false): Promise<boolean> {
  const defLabel = def ? 'J/n' : 'j/N'
  const a = await ask(`${question} (${defLabel})`, '')
  if (!a) return def
  return /^(j|y|ja|yes)$/i.test(a)
}

async function askNumber(question: string, def: number, min = 0): Promise<number> {
  for (;;) {
    const raw = await ask(question, String(def))
    const n = parseInt(raw, 10)
    if (Number.isFinite(n) && n >= min) return n
    console.log(`    ⚠  Bitte eine Zahl ≥ ${min} eingeben.`)
  }
}

async function pause(prompt = 'Weiter mit ENTER…'): Promise<void> {
  await ask(prompt, '')
}

function header(title: string): void {
  const line = '─'.repeat(Math.max(0, 57 - title.length))
  console.log(`\n┌─ ${title} ${line}┐`)
}

// ═════════════════════════════════════════════════════════════════════════════
// DATEI- / CONFIG- / I18N-HELFER
// ═════════════════════════════════════════════════════════════════════════════

const LOCALES = ['de', 'en', 'gsw'] as const
const localePath = (l: string) => join(__dir, `src/i18n/locales/${l}.json`)
const configPath = () => join(__dir, 'src/config/siteConfig.ts')

function readJson<T = unknown>(p: string): T {
  return JSON.parse(readFileSync(p, 'utf-8')) as T
}

function writeJson(p: string, data: unknown): void {
  writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf-8')
}

function setNested(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.')
  let cur: Record<string, unknown> = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i]
    if (typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {}
    cur = cur[k] as Record<string, unknown>
  }
  cur[parts[parts.length - 1]] = value
}

/** Schreibt einen i18n-Wert in alle Sprachdateien (en/gsw bekommen denselben Wert als Default). */
function setI18nKey(keyPath: string, value: string): void {
  for (const loc of LOCALES) {
    const p = localePath(loc)
    if (!existsSync(p)) continue
    const json = readJson<Record<string, unknown>>(p)
    setNested(json, keyPath, value)
    writeJson(p, json)
  }
}

function replace(text: string, search: string, replacement: string): string {
  if (!text.includes(search)) {
    console.warn(`    ⚠  Muster nicht gefunden: ${search.slice(0, 60)}`)
    return text
  }
  return text.replace(search, replacement)
}

/**
 * Findet `<key>: [...]` oder `<key>: {...}` in TypeScript-Quelltext und ersetzt
 * den Block-Inhalt. Klammerzählung respektiert String-Literale.
 */
function replaceConfigBlock(
  src: string, key: string, openChar: '[' | '{', newLiteral: string,
): string {
  const closeChar = openChar === '[' ? ']' : '}'
  const re = new RegExp(`(\\b${key}\\s*:\\s*)\\${openChar}`)
  const m = re.exec(src)
  if (!m) {
    console.warn(`    ⚠  Block "${key}: ${openChar}…${closeChar}" nicht gefunden`)
    return src
  }
  const startIdx = m.index + m[1].length
  let depth = 0
  let inString: '"' | "'" | '`' | null = null
  for (let i = startIdx; i < src.length; i++) {
    const c = src[i]
    if (inString) {
      if (c === inString && src[i - 1] !== '\\') inString = null
      continue
    }
    if (c === '"' || c === "'" || c === '`') { inString = c; continue }
    if (c === openChar) depth++
    else if (c === closeChar) {
      depth--
      if (depth === 0) {
        return src.slice(0, startIdx) + newLiteral + src.slice(i + 1)
      }
    }
  }
  console.warn(`    ⚠  Klammerende für "${key}" nicht gefunden`)
  return src
}

/** Schreibt/aktualisiert eine .env-Variable. Bestehende Datei wird respektiert. */
function upsertEnv(file: string, key: string, value: string): void {
  let content = existsSync(file) ? readFileSync(file, 'utf-8') : ''
  const re = new RegExp(`^${key}=.*$`, 'm')
  const line = `${key}=${value}`
  content = re.test(content) ? content.replace(re, line) : content + (content.endsWith('\n') || !content ? '' : '\n') + line + '\n'
  writeFileSync(file, content, 'utf-8')
}

// ═════════════════════════════════════════════════════════════════════════════
// CLI-DETECTION + WINGET-INSTALL
// ═════════════════════════════════════════════════════════════════════════════

function hasCli(cmd: string): boolean {
  try {
    execSync(`${cmd} --version`, { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function tryWingetInstall(packageId: string, label: string): boolean {
  if (process.platform !== 'win32' || !hasCli('winget')) {
    console.log(`    ℹ  winget nicht verfügbar – ${label} bitte manuell installieren.`)
    return false
  }
  console.log(`    📥 Installiere ${label} via winget…`)
  try {
    execSync(
      `winget install --id ${packageId} -e --silent --accept-source-agreements --accept-package-agreements`,
      { stdio: 'inherit' },
    )
    return true
  } catch {
    console.log(`    ⚠  winget-Installation von ${label} fehlgeschlagen.`)
    return false
  }
}

async function ensureCli(
  cmd: string, wingetId: string, label: string, manualUrl: string,
): Promise<boolean> {
  if (hasCli(cmd)) return true
  console.log(`\n  ℹ  ${label} (${cmd}) ist nicht installiert.`)
  const doInstall = await askYesNo('  Jetzt automatisch installieren?', true)
  if (!doInstall) {
    console.log(`  → Manueller Download: ${manualUrl}`)
    return false
  }
  if (!tryWingetInstall(wingetId, label)) {
    console.log(`  → Manueller Download: ${manualUrl}`)
    return false
  }
  if (hasCli(cmd)) return true
  console.log(`  ℹ  ${cmd} ist nach dem Install in dieser Shell noch nicht auf dem PATH.`)
  console.log(`     → Schließe das Setup, öffne ein neues Terminal und starte erneut.`)
  return false
}

// ═════════════════════════════════════════════════════════════════════════════
// REPO-BOOTSTRAP (ZIP-Download wenn EXE leer ausgepackt wurde)
// ═════════════════════════════════════════════════════════════════════════════

async function downloadRepo(dir: string): Promise<void> {
  if (!REPO_ZIP_URL) {
    console.error('  ❌ Keine Repo-URL eingebacken. Beim Build muss SETUP_REPO_ZIP_URL gesetzt sein.')
    process.exit(1)
  }
  const items = readdirSync(dir).filter(f => f !== 'setup.exe' && !f.startsWith('.setup'))
  if (items.length > 0) {
    console.log('  ⚠️  Aktueller Ordner ist nicht leer:')
    console.log('     ' + items.slice(0, 5).join(', ') + (items.length > 5 ? ` … (+${items.length - 5})` : ''))
    if (!await askYesNo('Trotzdem entpacken?')) { console.log('  Abgebrochen.'); process.exit(0) }
  }
  console.log('\n  ⬇️  Lade Repo-ZIP von', REPO_ZIP_URL)
  const res = await fetch(REPO_ZIP_URL)
  if (!res.ok) { console.error('  ❌ Download fehlgeschlagen: HTTP', res.status); process.exit(1) }
  const buf = Buffer.from(await res.arrayBuffer())
  const tmpZip = join(dir, '.setup-repo.zip')
  const tmpExtract = join(dir, '.setup-extract')
  writeFileSync(tmpZip, buf)
  if (existsSync(tmpExtract)) rmSync(tmpExtract, { recursive: true, force: true })
  mkdirSync(tmpExtract)
  console.log('  📦 Entpacke (' + Math.round(buf.length / 1024) + ' KB)…')
  try {
    execSync(`tar -xf "${tmpZip}" -C "${tmpExtract}"`, { stdio: 'pipe' })
  } catch {
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

async function bootstrap(dir: string): Promise<void> {
  if (existsSync(join(dir, 'src', 'config', 'siteConfig.ts'))) {
    console.log('  ℹ️  Repo bereits im Ordner gefunden — überspringe Download.\n')
    return
  }
  await downloadRepo(dir)
}

// ═════════════════════════════════════════════════════════════════════════════
// PHASE 1: BASISDATEN
// ═════════════════════════════════════════════════════════════════════════════

interface BaseData {
  channelName: string
  displayName: string
  heroSubtitle: string
  accentColor: string
  premiumName: string
  iName: string
  iCompany: string
  iStreet: string
  iCity: string
  iEmail: string
  copyright: string
  donationProvider: string   // Anzeigename ("StreamElements", "Ko-fi", …) – leer = keiner
  donationUrl: string
  donationLogo: string       // Pfad zum Provider-Logo (z.B. /img/logos/Kofi.webp)
  calendarUrl: string
}

interface DonationProvider {
  key: string
  label: string
  hint: string
  /** Default-Logopfad in public/img/logos/. Wenn die Datei dort nicht existiert,
   *  fragt das Setup nach einer eigenen URL bzw. fällt auf StreamElements.webp zurück. */
  defaultLogo: string
}

const DONATION_PROVIDERS: DonationProvider[] = [
  { key: 'streamelements', label: 'StreamElements', hint: 'z.B. https://streamelements.com/<name>/tip',     defaultLogo: '/img/logos/StreamElements.webp' },
  { key: 'kofi',           label: 'Ko-fi',          hint: 'z.B. https://ko-fi.com/<name>',                  defaultLogo: '/img/logos/Kofi.webp' },
  { key: 'patreon',        label: 'Patreon',        hint: 'z.B. https://www.patreon.com/<name>',            defaultLogo: '/img/logos/Patreon.webp' },
  { key: 'paypal',         label: 'PayPal.me',      hint: 'z.B. https://www.paypal.com/paypalme/<name>',    defaultLogo: '/img/logos/PayPal.webp' },
  { key: 'custom',         label: 'Anderer / eigene URL', hint: 'beliebige URL',                            defaultLogo: '/img/logos/StreamElements.webp' },
]

async function askDonationProvider(): Promise<{ provider: string; url: string; logoUrl: string }> {
  console.log('\n  — Donation-Provider —')
  console.log('    Wähle, wohin der Donation-Link führen soll:')
  DONATION_PROVIDERS.forEach((p, i) => console.log(`      ${i + 1}) ${p.label}`))
  console.log(`      ${DONATION_PROVIDERS.length + 1}) Später konfigurieren (überspringen)`)
  const choice = await askNumber('Auswahl', 1, 1)
  if (choice > DONATION_PROVIDERS.length) return { provider: '', url: '', logoUrl: '' }
  const sel = DONATION_PROVIDERS[choice - 1]
  let label = sel.label
  if (sel.key === 'custom') {
    label = await ask('Anzeigename des Providers (wird auf der Karte angezeigt)', 'Donation')
  }
  console.log(`    ${sel.hint}`)
  const url = await ask(`${label} URL (leer = überspringen)`, '')
  if (!url) return { provider: '', url: '', logoUrl: '' }

  // Logo: Default vorschlagen; wenn die Datei in public/ nicht existiert, hinweisen.
  const defaultExists = existsSync(join(__dir, 'public', sel.defaultLogo.replace(/^\//, '')))
  if (!defaultExists && sel.key !== 'streamelements') {
    console.log(`    ℹ  ${sel.defaultLogo} liegt noch nicht in public/ – ersetze es nach`)
    console.log(`        dem Setup oder gib jetzt einen anderen Pfad an.`)
  }
  const logoUrl = await ask('Logo-Pfad für die Donate-Card', sel.defaultLogo)
  return { provider: label, url, logoUrl }
}

async function askBaseData(): Promise<BaseData> {
  header('1) Basisdaten')
  console.log('  Beantworte die folgenden Fragen. [Wert in Klammern] = Standard.\n')

  const channelName  = await ask('Twitch-Kanalname (Kleinbuchstaben, z.B. meinkanal)')
  const displayName  = await ask('Anzeigename (z.B. MeinKanal)')
  const heroSubtitle = await ask('Tagline / Untertitel (z.B. Gaming, Streams & Clips)')
  const accentColor  = await ask('Akzentfarbe (Hex)', '#7C4DFF')
  const premiumName  = await ask('Name des Premium-Bereichs', 'OnlyBart')

  console.log('\n  — Impressum (Pflicht lt. TMG) —')
  const iName    = await ask('Vollständiger Name')
  const iCompany = await ask('Firma / Unternehmen (leer = keins)', '')
  const iStreet  = await ask('Straße + Hausnummer')
  const iCity    = await ask('PLZ + Ort')
  const iEmail   = await ask('E-Mail-Adresse')

  const copyright = await ask('Copyright-Inhaber', iCompany || displayName)

  const { provider: donationProvider, url: donationUrl, logoUrl: donationLogo } = await askDonationProvider()

  console.log('\n  — Streamplan-Kalender —')
  console.log('    Beliebige öffentliche Kalender-URL (ICS/iCal-Feed) — z.B.')
  console.log('    kalender.digital, Nextcloud-Kalender, Google Calendar (Public),')
  console.log('    Apple iCloud (Public), Outlook / Office 365 (Public).')
  const calendarUrl = await ask('Streamplan-Kalender-URL (leer = später)', '')

  return {
    channelName, displayName, heroSubtitle, accentColor, premiumName,
    iName, iCompany, iStreet, iCity, iEmail,
    copyright, donationProvider, donationUrl, donationLogo, calendarUrl,
  }
}

function applyBaseData(b: BaseData): void {
  let cfg = readFileSync(configPath(), 'utf-8')

  cfg = replace(cfg, `name: 'HD1920x1080',`,            `name: '${b.displayName}',`)
  cfg = replace(cfg, `name: 'Stefan Slapnik',`,          `name: '${b.iName}',`)
  cfg = replace(cfg, `company: 'FullHD Media',`,         `company: '${b.iCompany}',`)
  cfg = replace(cfg, `street: 'Kolpingstraße 9',`,       `street: '${b.iStreet}',`)
  cfg = replace(cfg, `city: '95615 Marktredwitz',`,      `city: '${b.iCity}',`)
  cfg = replace(cfg, `email: 'Admin@HD1920x1080.de',`,   `email: '${b.iEmail}',`)
  cfg = replace(cfg, `copyrightHolder: 'FullHD Media',`, `copyrightHolder: '${b.copyright}',`)
  cfg = replace(cfg, `accentColor: '#7C4DFF',`,          `accentColor: '${b.accentColor}',`)
  cfg = replace(cfg, `title: 'OnlyBart',`,               `title: '${b.premiumName}',`)

  if (b.donationUrl)
    cfg = replace(cfg,
      `donationUrl: 'https://streamelements.com/hd1920x1080-5003/tip',`,
      `donationUrl: '${b.donationUrl}',`)
  if (b.donationProvider)
    cfg = replace(cfg, `label: 'StreamElements',`, `label: '${b.donationProvider}',`)
  if (b.donationLogo)
    cfg = replace(cfg,
      `logoUrl: '/img/logos/StreamElements.webp',`,
      `logoUrl: '${b.donationLogo}',`)
  if (b.calendarUrl)
    cfg = replace(cfg,
      `icsUrl: 'https://export.kalender.digital/ics/0/4ccef74582e0eb8d7026/twitchhd1920x1080.ics',`,
      `icsUrl: '${b.calendarUrl}',`)

  // Wenn ein Provider gewählt wurde, Titel/Desc der Donation-Karte auf der
  // Startseite anpassen (die Karte selbst bleibt in der links[]-Liste).
  if (b.donationProvider && b.donationProvider !== 'StreamElements') {
    setI18nKey('links.streamelements.title', b.donationProvider)
    setI18nKey('links.streamelements.desc', `Spenden an ${b.donationProvider}`)
    console.log(`  ✅ Donation-Karte umbenannt auf „${b.donationProvider}"`)
  }

  writeFileSync(configPath(), cfg, 'utf-8')
  console.log('\n  ✅ src/config/siteConfig.ts (Basisdaten) aktualisiert')

  for (const locale of LOCALES) {
    const p = localePath(locale)
    if (!existsSync(p)) continue
    let json = readFileSync(p, 'utf-8')
    json = json.replace(
      `"subtitle": "FullHD – Gaming, Streams & Clips"`,
      `"subtitle": "${b.heroSubtitle}"`,
    )
    writeFileSync(p, json, 'utf-8')
  }
  console.log('  ✅ Sprachdateien (de/en/gsw.json) aktualisiert')

  const envPath = join(__dir, '.env')
  if (!existsSync(envPath)) {
    writeFileSync(envPath,
`# Supabase – nach Schritt 3 ausgefüllt
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Twitch – nach Schritt 3 ausgefüllt
VITE_TWITCH_CLIENT_ID=
VITE_CHANNEL_NAME=${b.channelName}
`, 'utf-8')
    console.log('  ✅ .env erstellt')
  } else {
    upsertEnv(envPath, 'VITE_CHANNEL_NAME', b.channelName)
    console.log('  ✅ .env (VITE_CHANNEL_NAME) aktualisiert')
  }
  summary.done.push('Basisdaten in siteConfig.ts, Sprachdateien und .env geschrieben')
}

// ═════════════════════════════════════════════════════════════════════════════
// PHASE 2: INTERAKTIVE LISTEN
// ═════════════════════════════════════════════════════════════════════════════

/** Repräsentiert einen LinkItem-Eintrag für Code-Generierung. */
interface LinkEntry {
  titleKey: string
  descKey?: string
  url: string
  icon: string
  target?: '_blank' | '_self'
  discountCode?: string
}

function linkEntryToTs(e: LinkEntry, indent = '    '): string {
  const lines: string[] = [`${indent}{`]
  lines.push(`${indent}  titleKey: '${e.titleKey}',`)
  if (e.descKey) lines.push(`${indent}  descKey: '${e.descKey}',`)
  lines.push(`${indent}  url: '${e.url}',`)
  lines.push(`${indent}  icon: '${e.icon}',`)
  if (e.target) lines.push(`${indent}  target: '${e.target}',`)
  if (e.discountCode) lines.push(`${indent}  discountCode: '${e.discountCode}',`)
  lines.push(`${indent}},`)
  return lines.join('\n')
}

function arrayLiteralOf(entries: LinkEntry[]): string {
  if (entries.length === 0) return '[]'
  return '[\n' + entries.map(e => linkEntryToTs(e, '    ')).join('\n') + '\n  ]'
}

async function askLinkEntry(i: number, sectionLabel: string, ns: string): Promise<LinkEntry | null> {
  console.log(`\n  — ${sectionLabel} Eintrag ${i + 1} —`)
  const title = await ask('Titel (leer = abbrechen)')
  if (!title) return null
  const desc   = await ask('Beschreibung (optional)', '')
  const url    = await ask('Ziel-URL (oder interner Pfad wie /streamplan)')
  const icon   = await ask('Icon-Pfad (z.B. /img/logos/youtube.svg)', '/img/logos/email.svg')
  const internal = url.startsWith('/')
  const target = (await askYesNo(`Im selben Tab öffnen?`, internal)) ? '_self' : '_blank'
  const discount = await ask('Rabattcode (leer = keiner)', '')

  const titleKey = `custom.${ns}.entry${i + 1}.title`
  const descKey  = desc ? `custom.${ns}.entry${i + 1}.desc` : undefined
  setI18nKey(titleKey, title)
  if (descKey) setI18nKey(descKey, desc)

  return {
    titleKey,
    descKey,
    url,
    icon,
    target,
    discountCode: discount || undefined,
  }
}

async function configureLinkSection(
  sectionKey: 'links' | 'games' | 'clips' | 'partners',
  label: string,
): Promise<boolean> {
  console.log(`\n  ── Sektion: ${label} ──`)
  if (!await askYesNo(`${label} jetzt konfigurieren?`, false)) {
    summary.remaining.push(`${label} (${sectionKey}[] in src/config/siteConfig.ts) manuell bearbeiten`)
    console.log(`  ⏭  Übersprungen – behalte die Default-Einträge bei (später anpassen).`)
    return false
  }

  const count = await askNumber(`Wie viele Einträge in ${label}?`, 3, 0)
  const entries: LinkEntry[] = []
  for (let i = 0; i < count; i++) {
    const e = await askLinkEntry(i, label, sectionKey)
    if (e) entries.push(e)
  }

  // Nach den vorab geplanten Einträgen: solange „noch einen?" abfragen,
  // wie der User Einträge hinzufügen möchte (frei nachschießen).
  for (;;) {
    if (!await askYesNo(`\n  Noch einen ${label}-Eintrag hinzufügen?`, false)) break
    const e = await askLinkEntry(entries.length, label, sectionKey)
    if (e) entries.push(e)
  }

  let cfg = readFileSync(configPath(), 'utf-8')
  cfg = replaceConfigBlock(cfg, sectionKey, '[', arrayLiteralOf(entries))
  writeFileSync(configPath(), cfg, 'utf-8')
  console.log(`  ✅ ${label} (${entries.length} Einträge) in siteConfig.ts geschrieben`)
  summary.done.push(`${label}: ${entries.length} Einträge konfiguriert`)
  return true
}

async function configureRedirects(): Promise<void> {
  console.log('\n  ── Sektion: Kurz-URLs (Redirects) ──')
  if (!await askYesNo('Redirects jetzt konfigurieren?', false)) {
    summary.remaining.push('Redirects (redirects{} in src/config/siteConfig.ts) manuell bearbeiten')
    console.log('  ⏭  Übersprungen.')
    return
  }
  const count = await askNumber('Wie viele Weiterleitungen?', 5, 0)
  const pairs: Array<[string, string]> = []
  const askRedirect = async (idx: number): Promise<[string, string] | null> => {
    console.log(`\n  — Redirect ${idx + 1} —`)
    let short = await ask('Kurz-URL (mit /, z.B. /discord; leer = abbrechen)')
    if (!short) return null
    if (!short.startsWith('/')) short = '/' + short
    const target = await ask('Ziel-URL (komplette URL)')
    if (!target) return null
    return [short, target]
  }
  for (let i = 0; i < count; i++) {
    const p = await askRedirect(i)
    if (p) pairs.push(p)
  }
  for (;;) {
    if (!await askYesNo(`\n  Noch eine Weiterleitung hinzufügen?`, false)) break
    const p = await askRedirect(pairs.length)
    if (p) pairs.push(p)
  }
  const literal = pairs.length === 0
    ? '{}'
    : '{\n' + pairs.map(([k, v]) => `    '${k}': '${v}',`).join('\n') + '\n  }'
  let cfg = readFileSync(configPath(), 'utf-8')
  cfg = replaceConfigBlock(cfg, 'redirects', '{', literal)
  writeFileSync(configPath(), cfg, 'utf-8')
  console.log(`  ✅ ${pairs.length} Redirects in siteConfig.ts geschrieben`)
  summary.done.push(`Redirects: ${pairs.length} Weiterleitungen konfiguriert`)
}

async function configureStreamplanCategories(): Promise<void> {
  console.log('\n  ── Sektion: Streamplan-Kategorien ──')
  if (!await askYesNo('Streamplan-Kategorien jetzt konfigurieren?', false)) {
    summary.remaining.push('Streamplan-Kategorien (streamplan.categories[] in siteConfig.ts) manuell bearbeiten')
    console.log('  ⏭  Übersprungen.')
    return
  }
  console.log('  ℹ  Jede Kategorie braucht eine eigene öffentliche Kalender-URL')
  console.log('     (ICS/iCal-Feed) — z.B. kalender.digital, Nextcloud, Google Calendar Public, etc.')
  const count = await askNumber('Wie viele Kategorien?', 3, 0)
  const lines: string[] = []
  const askCategory = async (idx: number): Promise<string | null> => {
    console.log(`\n  — Kategorie ${idx + 1} —`)
    const label = await ask('Label (z.B. Just Chatting; leer = abbrechen)')
    if (!label) return null
    const url   = await ask('Öffentliche Kalender-URL (ICS/iCal-Feed)')
    const color = await ask('Farbe (Hex)', '#7C4DFF')
    const labelKey = `custom.streamplan.cat${idx + 1}`
    setI18nKey(labelKey, label)
    return (
`      {
        id: ${idx + 1},
        labelKey: '${labelKey}',
        url: '${url}',
        color: '${color}',
      },`)
  }
  for (let i = 0; i < count; i++) {
    const l = await askCategory(i)
    if (l) lines.push(l)
  }
  for (;;) {
    if (!await askYesNo(`\n  Noch eine Kategorie hinzufügen?`, false)) break
    const l = await askCategory(lines.length)
    if (l) lines.push(l)
  }
  const literal = lines.length === 0 ? '[]' : '[\n' + lines.join('\n') + '\n    ]'
  let cfg = readFileSync(configPath(), 'utf-8')
  cfg = replaceConfigBlock(cfg, 'categories', '[', literal)
  writeFileSync(configPath(), cfg, 'utf-8')
  console.log(`  ✅ ${lines.length} Streamplan-Kategorien geschrieben`)
  summary.done.push(`Streamplan: ${lines.length} Kategorien konfiguriert`)
}

async function runListPhase(): Promise<void> {
  header('2) Listen & Inhalte')
  console.log('  Pro Sektion fragen wir: „Jetzt konfigurieren oder später?"')
  console.log('  „Später" bedeutet: du bearbeitest siteConfig.ts manuell mit dem Editor.\n')

  await configureLinkSection('links',    'Hauptlinks')
  await configureLinkSection('games',    'Game-Links')
  await configureLinkSection('clips',    'Clip-/Shorts-Links')
  await configureLinkSection('partners', 'Partner mit Rabattcodes')
  await configureRedirects()
  await configureStreamplanCategories()
}

// ═════════════════════════════════════════════════════════════════════════════
// PHASE 3: TWITCH-APP + SUPABASE WALKTHROUGH
// ═════════════════════════════════════════════════════════════════════════════

interface TwitchCreds {
  clientId: string
  clientSecret: string
  refreshToken: string
}
interface SupabaseCreds {
  url: string
  anonKey: string
  serviceRoleKey: string
  projectRef: string
}

async function twitchAppWalkthrough(): Promise<TwitchCreds> {
  header('3a) Twitch-App erstellen')
  console.log(`  Step-by-Step:

    1. Browser öffnen:  https://dev.twitch.tv/console/apps
    2. Mit Twitch-Account einloggen.
    3. Klicke auf  „Register Your Application".
    4. Felder ausfüllen:
         Name:       beliebig (z.B. „MeinKanal Landing Page")
         Category:   Website Integration
         OAuth Redirect URLs:
            ▸ http://localhost:3000  (Platzhalter — der echte Wert kommt
              nach dem Supabase-Setup; trag ihn später nach.)
    5. Klicke „Create".
    6. Klicke bei der erstellten App auf „Manage".
    7. Notiere die  Client ID  (sichtbar) und generiere ein  New Secret.
       → Das Secret ist nur einmal sichtbar — kopieren!
`)
  await pause('Wenn fertig: ENTER drücken.')
  const clientId     = await ask('Twitch Client ID')
  const clientSecret = await ask('Twitch Client Secret')

  header('3b) Refresh-Token für Twitch')
  console.log(`  Der Bot + die GitHub-Actions brauchen einen langfristigen
  Refresh-Token mit bestimmten Scopes.

  Einfachster Weg:
    1. Browser:  https://twitchtokengenerator.com
    2. Wähle „Custom Scope Token" und aktiviere alle folgenden Scopes:
         channel:read:subscriptions
         moderation:read
         channel:manage:moderators
         channel:read:redemptions
         chat:read
         chat:edit
    3. Klicke „Generate Token" → mit Twitch einloggen → autorisieren.
    4. Aus dem Ergebnis brauchst du den  Refresh Token  (nicht den Access Token).
`)
  await pause('Wenn fertig: ENTER drücken.')
  const refreshToken = await ask('Twitch Refresh Token')
  summary.done.push('Twitch-App eingerichtet (Client-ID + Secret + Refresh-Token)')
  return { clientId, clientSecret, refreshToken }
}

async function supabaseWalkthrough(twitch: TwitchCreds): Promise<SupabaseCreds> {
  header('3c) Supabase-Projekt erstellen')
  console.log(`  Step-by-Step:

    1. Browser:  https://supabase.com  → Account anlegen / einloggen.
    2. „New project" → Region wählen → Datenbank-Passwort vergeben → Create.
    3. Warten bis das Projekt fertig provisioniert ist (~2 Minuten).
    4. Im Projekt: Sidebar → „Settings" → „API".
    5. Notiere folgende Werte:
         ▸ Project URL              (https://xxx.supabase.co)
         ▸ Project anon/public key
         ▸ service_role key  (⚠ geheim halten — nie ins Repo committen!)
`)
  await pause('Wenn fertig: ENTER drücken.')
  const url            = await ask('Supabase Project URL')
  const anonKey        = await ask('Supabase anon Key')
  const serviceRoleKey = await ask('Supabase service_role Key')
  // Project-Ref aus der URL extrahieren (https://<ref>.supabase.co)
  const projectRef = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i)?.[1] ?? ''

  header('3d) Datenbank-Migrationen ausführen')
  console.log(`  Im selben Supabase-Projekt:

    1. Sidebar → „SQL Editor".
    2. Öffne nacheinander folgende Dateien in deinem Editor und kopiere den
       gesamten Inhalt jeweils ins SQL Editor und klicke „Run":

         supabase/migrations/20260424134835_remote_schema.sql
         supabase/migrations/20260425000000_security_fixes.sql
         supabase/migrations/20260509000000_clipvoting_cleanup.sql
         supabase/migrations/20260509000001_mod_test_redeem.sql
         supabase/migrations/20260509000002_realtime_redeemed_rewards.sql
         supabase/migrations/20260510000000_rewards_sequential_ids.sql

  Wenn du die Supabase-CLI installiert hast, kannst du stattdessen
  alles auf einmal pushen: 'supabase link --project-ref ${projectRef || '<ref>'}'
  gefolgt von 'supabase db push'.
`)
  await pause('Wenn fertig: ENTER drücken.')

  header('3e) Twitch OAuth in Supabase aktivieren')
  console.log(`  Step-by-Step:

    1. Supabase → Authentication → Providers → Twitch.
    2. Toggle „Enable Sign in with Twitch" auf AN.
    3. Trage ein:
         Client ID:      ${twitch.clientId}
         Client Secret:  ${twitch.clientSecret}
    4. Kopiere die angezeigte  Callback URL  (sieht aus wie
         ${url || 'https://xxx.supabase.co'}/auth/v1/callback).
    5. Zurück zu  https://dev.twitch.tv/console/apps  → deine App → „Manage".
    6. Bei „OAuth Redirect URLs": die Callback-URL aus Schritt 4 eintragen
       (den localhost-Platzhalter kannst du entfernen).  Klicke „Save".
`)
  await pause('Wenn fertig: ENTER drücken.')
  summary.done.push('Supabase-Projekt eingerichtet (URL, Keys, Migrationen, Twitch-OAuth)')
  return { url, anonKey, serviceRoleKey, projectRef }
}

// ═════════════════════════════════════════════════════════════════════════════
// PHASE 4: GITHUB (gh CLI)
// ═════════════════════════════════════════════════════════════════════════════

function ghJson(args: string): unknown {
  return JSON.parse(execSync(`gh ${args}`, { stdio: ['ignore', 'pipe', 'pipe'] }).toString())
}

function ghAuthOk(): boolean {
  try { execSync('gh auth status', { stdio: 'pipe' }); return true } catch { return false }
}

async function ensureGhAuth(): Promise<boolean> {
  if (ghAuthOk()) return true
  console.log(`\n  ⚠  Du bist mit der GitHub CLI noch nicht eingeloggt.

  Bitte führe in einem zweiten Terminal aus:
      gh auth login

  Wähle:
    Account?           → GitHub.com
    Protokoll?         → HTTPS
    Authentifizierung? → Login with a web browser
    Scopes?            → repo, workflow, admin:public_key   (Default reicht)
`)
  await pause('Wenn du eingeloggt bist: ENTER drücken.')
  return ghAuthOk()
}

async function ensureRepo(): Promise<{ owner: string; repo: string } | null> {
  // Prüfe, ob in diesem Verzeichnis schon ein git-Repo mit Remote „origin" liegt.
  let remoteUrl = ''
  try {
    remoteUrl = execSync('git config --get remote.origin.url', { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim()
  } catch {
    // kein Remote
  }
  if (remoteUrl) {
    // Aus URL den Owner/Repo extrahieren (https oder ssh)
    const m = remoteUrl.match(/[/:]([^/:]+)\/([^/]+?)(?:\.git)?$/)
    if (m) {
      console.log(`  ✅ GitHub-Repo bereits verbunden: ${m[1]}/${m[2]}`)
      return { owner: m[1], repo: m[2] }
    }
  }

  console.log(`\n  Es gibt noch keinen GitHub-Remote für dieses Verzeichnis.`)
  if (!await askYesNo('Jetzt ein neues GitHub-Repo erstellen?', true)) {
    summary.remaining.push('GitHub-Repo selbst anlegen + als „origin"-Remote hinzufügen')
    return null
  }

  const defaultName = __dir.split(/[\\/]/).filter(Boolean).pop() ?? 'twitch-landingpage'
  const name = await ask('Repo-Name', defaultName)
  const visAns = await ask('Sichtbarkeit (public/private)', 'public')
  const visibility = /^priv/i.test(visAns) ? '--private' : '--public'
  try {
    // Repo erstellen + lokales Verzeichnis pushen (--source=.) auf Default-Branch.
    execSync(`gh repo create "${name}" ${visibility} --source=. --remote=origin --push`, { stdio: 'inherit' })
  } catch {
    console.log('  ⚠  Repo-Erstellung fehlgeschlagen.')
    summary.remaining.push('GitHub-Repo manuell anlegen + Remote setzen')
    return null
  }
  // Owner aus gh erfragen
  try {
    const data = ghJson('repo view --json owner,name') as { owner: { login: string }, name: string }
    summary.done.push(`GitHub-Repo „${data.owner.login}/${data.name}" angelegt und gepusht`)
    return { owner: data.owner.login, repo: data.name }
  } catch {
    return null
  }
}

function setGhSecret(name: string, value: string): boolean {
  if (!value) return false
  try {
    // Wert über stdin reinreichen, damit er nicht in der Prozessliste auftaucht.
    execSync(`gh secret set ${name}`, { input: value, stdio: ['pipe', 'pipe', 'pipe'] })
    console.log(`    ✅ Secret gesetzt: ${name}`)
    return true
  } catch {
    console.log(`    ⚠  Konnte Secret „${name}" nicht setzen.`)
    return false
  }
}

async function pushAllSecrets(args: {
  twitch: TwitchCreds
  supabase: SupabaseCreds
  channelName: string
  repo: { owner: string; repo: string }
}): Promise<void> {
  header('4b) GitHub-Secrets setzen')

  const repoSlug = `${args.repo.owner}/${args.repo.repo}`
  console.log(`  ───────────────────────────────────────────────────────────────
   Was ist ein „GitHub PAT" und wozu brauchen wir ihn?
  ───────────────────────────────────────────────────────────────

  PAT = Personal Access Token. Das ist ein langer Zufalls-String,
  der wie ein Passwort funktioniert – nur eben für GitHub-APIs
  statt für die Login-Seite.

  Warum brauchst du einen?
  Dein Twitch-Refresh-Token läuft regelmäßig ab. Ein Cron-Job
  (Workflow „Daily Twitch Sync", läuft alle 2 Stunden auf GitHub)
  holt sich automatisch einen neuen Refresh-Token und muss ihn
  dann als neues GitHub-Secret speichern. Dafür braucht der
  Workflow Schreibrechte auf deine Repository-Secrets – und
  genau die kann der eingebaute GITHUB_TOKEN von GitHub Actions
  NICHT geben. Also legst du einmal einen PAT mit genau diesen
  Rechten an, speicherst ihn als Secret „GH_TOKEN", und der
  Workflow erledigt die Rotation in Zukunft selbständig.

  Wenn du diesen Schritt überspringst, läuft alles trotzdem –
  bis der Twitch-Refresh-Token irgendwann abläuft. Dann musst
  du ihn manuell neu generieren (siehe Schritt 3b weiter oben).

  ───────────────────────────────────────────────────────────────
   So legst du den PAT an — Klick für Klick
  ───────────────────────────────────────────────────────────────

    1. Browser öffnen:
         https://github.com/settings/personal-access-tokens/new

       (Falls GitHub nach dem Login fragt: einloggen. Falls
        die Seite leer aussieht, im linken Menü auf
        „Fine-grained tokens" klicken → „Generate new token".)

    2. Das Formular ausfüllen — Feld für Feld:

       ┌─ Token name ────────────────────────────────────────┐
       │  Beliebiger Name, z.B.  „twitch-sync ${args.repo.repo}"
       │  (Hilft dir später, ihn unter mehreren Tokens
       │   wiederzufinden – GitHub zeigt ihn nirgendwo
       │   anders an.)
       └─────────────────────────────────────────────────────┘

       ┌─ Expiration (Ablaufdatum) ──────────────────────────┐
       │  „Custom" → 1 Jahr in der Zukunft wählen.
       │  Oder „No expiration", wenn du nicht jährlich
       │  einen neuen PAT erzeugen willst (weniger sicher,
       │  aber bequemer für kleine Hobby-Setups).
       │  GitHub erinnert dich per Mail kurz vor Ablauf.
       └─────────────────────────────────────────────────────┘

       ┌─ Description ───────────────────────────────────────┐
       │  Optional, z.B.  „Rotiert TWITCH_REFRESH_TOKEN"
       └─────────────────────────────────────────────────────┘

       ┌─ Resource owner ────────────────────────────────────┐
       │  Wähle  „${args.repo.owner}"
       │  (= dein GitHub-Account oder die Organisation,
       │   in der das Repo liegt).
       └─────────────────────────────────────────────────────┘

       ┌─ Repository access ─────────────────────────────────┐
       │  „Only select repositories" anklicken.
       │  Im Dropdown darunter:  ${repoSlug}  auswählen.
       │  (NICHT „All repositories" – Prinzip der minimalen
       │   Rechte: der Token darf nur an dieses eine Repo.)
       └─────────────────────────────────────────────────────┘

       ┌─ Permissions → Repository permissions ──────────────┐
       │  Liste aufklappen und exakt diese zwei auf
       │  „Read and write" stellen, ALLE anderen auf
       │  „No access" lassen:
       │
       │     • Secrets               → Read and write
       │     • Actions               → Read and write
       │
       │  (Manche Versionen der Oberfläche zeigen Secrets
       │   nur, wenn du oben „Repository access: Only
       │   select repositories" gewählt hast – falls die
       │   Option fehlt, prüf den Schritt davor.)
       └─────────────────────────────────────────────────────┘

       Account permissions / Organization permissions:
       NICHTS ankreuzen, alles auf „No access" lassen.

    3. Ganz unten auf „Generate token" klicken.

    4. ⚠  WICHTIG: Der Token wird jetzt EINMALIG angezeigt
       und beginnt mit  github_pat_...
       Kopiere ihn JETZT in die Zwischenablage. Verlässt du
       die Seite, ist er weg – dann hilft nur „Token löschen
       und neu erzeugen".

       Bewahre den Token nirgends im Repo, in Notizen oder
       Chat-Nachrichten auf. Sobald er als GitHub-Secret
       gespeichert ist (gleich im nächsten Schritt), kannst
       du ihn aus der Zwischenablage löschen.

    5. Zurück hier in dieses Fenster wechseln und unten
       beim Prompt „GitHub PAT" den Token einfügen.
       (Rechtsklick → Einfügen, oder Strg+V – der Token
        wird beim Tippen nicht maskiert, das ist normal.)

  ───────────────────────────────────────────────────────────────

  Skip-Hinweis: Drückst du nur ENTER (leer), überspringen wir
  diesen Schritt. Du kannst den PAT später nachreichen, indem
  du das Setup nochmal startest und „Nur Twitch + Supabase +
  GitHub" wählst – oder das Secret manuell unter
  https://github.com/${repoSlug}/settings/secrets/actions
  als „GH_TOKEN" anlegst.
`)
  await pause('Wenn du den PAT erzeugt + kopiert hast: ENTER drücken.')
  const ghToken = await ask('GitHub PAT (beginnt mit github_pat_…, leer = überspringen)', '')

  const secrets: Record<string, string> = {
    VITE_SUPABASE_URL:        args.supabase.url,
    VITE_SUPABASE_ANON_KEY:   args.supabase.anonKey,
    SUPABASE_SERVICE_ROLE_KEY: args.supabase.serviceRoleKey,
    VITE_TWITCH_CLIENT_ID:    args.twitch.clientId,
    TWITCH_CLIENT_SECRET:     args.twitch.clientSecret,
    TWITCH_REFRESH_TOKEN:     args.twitch.refreshToken,
    CHANNEL_NAME:             args.channelName,
  }
  if (ghToken) secrets.GH_TOKEN = ghToken

  let setCount = 0
  for (const [k, v] of Object.entries(secrets)) {
    if (v && setGhSecret(k, v)) setCount++
  }
  summary.done.push(`GitHub-Secrets gesetzt: ${setCount}/${Object.keys(secrets).length}`)
}

/**
 * DNS-Anleitung für die GitHub-Pages-Domain.
 * Apex (meinkanal.de):       A + AAAA-Records auf die 4 GitHub-IPs.
 * Subdomain (www.meinkanal): CNAME auf <owner>.github.io.
 * Quelle: https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site
 */
function printDnsInstructions(domain: string, owner: string): void {
  const parts = domain.replace(/\.$/, '').split('.')
  const isApex = parts.length <= 2  // z.B. "meinkanal.de" → apex; "www.meinkanal.de" → subdomain
  const host = isApex ? '@' : parts.slice(0, -2).join('.')

  console.log(`
  ┌─ DNS-Einstellungen beim Domain-Anbieter ───────────────────────────┐

  Domain:        ${domain}    (${isApex ? 'Apex' : 'Subdomain'})
  Login bei:     deinem Domain-Provider (Strato, IONOS, Namecheap,
                 Cloudflare, GoDaddy, INWX, Hetzner DNS, …).
  Menüpunkt:     „DNS-Verwaltung" / „DNS Records" / „Zonenverwaltung".
`)

  if (isApex) {
    console.log(`  Lege folgende Einträge an (TTL = 3600 oder Default):

  ┌────────┬──────┬────────────────────────────────┐
  │ Typ    │ Host │ Wert                           │
  ├────────┼──────┼────────────────────────────────┤
  │ A      │ ${host}    │ 185.199.108.153                │
  │ A      │ ${host}    │ 185.199.109.153                │
  │ A      │ ${host}    │ 185.199.110.153                │
  │ A      │ ${host}    │ 185.199.111.153                │
  │ AAAA   │ ${host}    │ 2606:50c0:8000::153            │
  │ AAAA   │ ${host}    │ 2606:50c0:8001::153            │
  │ AAAA   │ ${host}    │ 2606:50c0:8002::153            │
  │ AAAA   │ ${host}    │ 2606:50c0:8003::153            │
  └────────┴──────┴────────────────────────────────┘

  Optional zusätzlich (damit www.${domain} auch funktioniert):

  ┌────────┬──────┬────────────────────────────────┐
  │ CNAME  │ www  │ ${owner}.github.io.${' '.repeat(Math.max(0, 12 - owner.length))}        │
  └────────┴──────┴────────────────────────────────┘

  Manche Provider verlangen den Punkt am Ende ("${owner}.github.io."),
  andere fügen ihn automatisch hinzu – beides ist OK.`)
  } else {
    console.log(`  Lege einen einzigen Eintrag an (TTL = 3600 oder Default):

  ┌────────┬──────────┬────────────────────────────────┐
  │ Typ    │ Host     │ Wert                           │
  ├────────┼──────────┼────────────────────────────────┤
  │ CNAME  │ ${host.padEnd(8)} │ ${owner}.github.io.            │
  └────────┴──────────┴────────────────────────────────┘

  Manche Provider verlangen den Punkt am Ende ("${owner}.github.io."),
  andere fügen ihn automatisch hinzu – beides ist OK.

  Optional (damit auch die nackte ${parts.slice(-2).join('.')} weiterleitet):
  Lege beim Provider eine HTTP-Weiterleitung (URL-Redirect) von
  ${parts.slice(-2).join('.')} → https://${domain} an.`)
  }

  console.log(`
  ⏱  DNS-Propagation kann 5 Minuten bis 24 Stunden dauern.
       Prüfen mit:   nslookup ${domain}
                     oder  https://dnschecker.org/#A/${domain}

  🔒 HTTPS wird von GitHub Pages automatisch via Let's Encrypt ausgestellt,
       sobald die DNS-Einträge stehen (im Repo: Settings → Pages → „Enforce HTTPS"
       ist bereits aktiviert).

  └────────────────────────────────────────────────────────────────────┘
`)
  summary.remaining.push(`DNS-Records bei deinem Domain-Anbieter setzen (siehe Anleitung oben für ${domain})`)
}

async function enableGitHubPages(repo: { owner: string; repo: string }): Promise<void> {
  header('4c) GitHub Pages aktivieren')
  // POST = neu anlegen; PUT = aktualisieren. Wir versuchen erst POST.
  const path = `/repos/${repo.owner}/${repo.repo}/pages`
  try {
    execSync(`gh api -X POST ${path} -F build_type=workflow`, { stdio: 'pipe' })
    console.log('  ✅ GitHub Pages aktiviert (Source: GitHub Actions)')
  } catch {
    try {
      execSync(`gh api -X PUT ${path} -F build_type=workflow`, { stdio: 'pipe' })
      console.log('  ✅ GitHub Pages aktualisiert (Source: GitHub Actions)')
    } catch {
      console.log('  ⚠  Konnte Pages nicht per API aktivieren – bitte manuell:')
      console.log(`     Repo → Settings → Pages → Source: „GitHub Actions"`)
      summary.remaining.push('GitHub Pages: Source auf „GitHub Actions" stellen')
      return
    }
  }
  summary.done.push('GitHub Pages aktiviert (Source: GitHub Actions)')

  // Custom Domain anbieten
  if (await askYesNo('Eigene Domain (CNAME) konfigurieren?', false)) {
    const domain = await ask('Domain (z.B. meinkanal.de oder www.meinkanal.de)')
    if (domain) {
      try {
        execSync(`gh api -X PUT ${path} -F cname=${domain} -F https_enforced=true`, { stdio: 'pipe' })
        console.log(`  ✅ Custom Domain ${domain} gesetzt + HTTPS erzwungen`)
        summary.done.push(`Custom Domain „${domain}" gesetzt`)
        printDnsInstructions(domain, repo.owner)
      } catch {
        console.log('  ⚠  Setzen der Custom-Domain fehlgeschlagen – bitte manuell in Settings → Pages.')
        summary.remaining.push(`Custom Domain „${domain}" in Repo-Settings setzen`)
        printDnsInstructions(domain, repo.owner)
      }
    }
  } else {
    // Ohne Custom Domain: base-Pfad in vite.config.ts an Repo-Namen anpassen
    const viteCfg = join(__dir, 'vite.config.ts')
    if (existsSync(viteCfg)) {
      let v = readFileSync(viteCfg, 'utf-8')
      if (v.includes(`base: '/'`)) {
        v = v.replace(`base: '/'`, `base: '/${repo.repo}/'`)
        writeFileSync(viteCfg, v, 'utf-8')
        console.log(`  ✅ vite.config.ts: base auf '/${repo.repo}/' gesetzt (für github.io-Pfad)`)
        summary.done.push(`vite.config.ts: base für GitHub-Pages-Pfad angepasst`)
      }
    }
  }
}

async function runGitHubPhase(args: {
  twitch: TwitchCreds
  supabase: SupabaseCreds
  channelName: string
}): Promise<{ owner: string; repo: string } | null> {
  header('4) GitHub einrichten')

  const ok = await ensureCli(
    'gh', 'GitHub.cli', 'GitHub CLI',
    'https://cli.github.com/',
  )
  if (!ok) {
    console.log(`
  GitHub-Schritte werden übersprungen. Folge stattdessen den manuellen Schritten:

  4a) gh CLI installieren:  https://cli.github.com/
  4b) Anmelden:  gh auth login
  4c) Secrets eintragen unter:  Repo → Settings → Secrets and variables → Actions

      Benötigte Secrets:
        VITE_SUPABASE_URL          = ${args.supabase.url}
        VITE_SUPABASE_ANON_KEY     = ${args.supabase.anonKey}
        SUPABASE_SERVICE_ROLE_KEY  = ${args.supabase.serviceRoleKey}
        VITE_TWITCH_CLIENT_ID      = ${args.twitch.clientId}
        TWITCH_CLIENT_SECRET       = ${args.twitch.clientSecret}
        TWITCH_REFRESH_TOKEN       = ${args.twitch.refreshToken}
        CHANNEL_NAME               = ${args.channelName}
        GH_TOKEN                   = (PAT mit secrets:write)

  4d) Pages aktivieren: Settings → Pages → Source: „GitHub Actions"
`)
    summary.remaining.push('GitHub: Repo, Secrets und Pages manuell einrichten (siehe Konsolen-Output oben)')
    return null
  }

  if (!await ensureGhAuth()) {
    summary.remaining.push('gh auth login + Setup erneut starten')
    return null
  }

  const repo = await ensureRepo()
  if (!repo) return null
  await pushAllSecrets({ ...args, repo })
  await enableGitHubPages(repo)
  return repo
}

// ═════════════════════════════════════════════════════════════════════════════
// PHASE 5: OPTIONALE MODULE
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Baut `PointsAndRewardSection` wieder in `LiveSection.tsx` ein.
 * Wird aufgerufen, wenn der User TwitchAddon im Setup ablehnt –
 * dann übernimmt die Web-App das Reward-UI direkt.
 * Idempotent: läuft mehrfach durch, ohne Doppeleinträge zu erzeugen.
 */
function enableInPagePointsAndRewards(): void {
  const liveSectionPath = join(__dir, 'src/components/LiveSection/LiveSection.tsx')
  if (!existsSync(liveSectionPath)) {
    console.log('  ⚠  src/components/LiveSection/LiveSection.tsx nicht gefunden – übersprungen.')
    return
  }
  let src = readFileSync(liveSectionPath, 'utf-8')
  let touched = false

  const importLine = `import PointsAndRewardSection from './PointsAndRewardSection'`
  if (!src.includes(importLine)) {
    src = src.replace(
      `import CurrentGame from '../CurrentGame/CurrentGame'`,
      `import CurrentGame from '../CurrentGame/CurrentGame'\nimport PointsAndRewardSection from './PointsAndRewardSection'`,
    )
    touched = true
  }

  if (!src.includes('<PointsAndRewardSection')) {
    // Vor dem schließenden </div> der embed-card (direkt vor </section>) einfügen.
    const marker = `                <p></p>\n            </div>\n        </section>`
    const replacement =
      `                <p></p>\n` +
      `                <div className="points-reward-section-wrapper">\n` +
      `                    <PointsAndRewardSection isLive={showStream}/>\n` +
      `                </div>\n` +
      `            </div>\n` +
      `        </section>`
    if (src.includes(marker)) {
      src = src.replace(marker, replacement)
      touched = true
    } else {
      console.log('  ⚠  Konnte Einfüge-Marker in LiveSection.tsx nicht finden – bitte manuell prüfen.')
    }
  }

  if (touched) {
    writeFileSync(liveSectionPath, src, 'utf-8')
    console.log('  ✅ PointsAndRewardSection wieder in LiveSection.tsx eingebaut')
    summary.done.push('LiveSection: PointsAndRewardSection in-page eingebaut (TwitchAddon übersprungen)')
  }
}

async function setupTwitchAddon(): Promise<void> {
  if (!await askYesNo('TwitchAddon (Kanalpunkte-Bot + Extension) jetzt einrichten?', false)) {
    summary.remaining.push('TwitchAddon optional – siehe TwitchAddon/SETUP.md')
    enableInPagePointsAndRewards()
    return
  }
  header('5a) TwitchAddon — ngrok-Tunnel')

  // 1) ngrok CLI sicherstellen (winget-Install oder Anleitung)
  const ngrokOk = await ensureCli(
    'ngrok', 'Ngrok.Ngrok', 'ngrok',
    'https://ngrok.com/download',
  )

  // 2) Authtoken holen
  console.log(`
    1. Browser:  https://dashboard.ngrok.com/signup  (Account anlegen oder einloggen).
    2. Authtoken kopieren:  https://dashboard.ngrok.com/get-started/your-authtoken
`)
  await pause('Wenn fertig: ENTER drücken.')
  const ngrokToken = await ask('NGROK_AUTHTOKEN')

  // 3) Authtoken sofort in die lokale ngrok-Config schreiben (für Dev-Tests)
  if (ngrokOk && ngrokToken) {
    try {
      execSync(`ngrok config add-authtoken ${ngrokToken}`, { stdio: 'pipe' })
      console.log('    ✅ ngrok config: Authtoken lokal hinterlegt')
    } catch {
      console.log('    ⚠  Konnte ngrok-Config nicht schreiben — Token wird trotzdem als GitHub-Secret gesetzt.')
    }
  }

  // 4) Static Domain reservieren (Free-Plan: 1 Domain kostenlos)
  console.log(`
  Im selben ngrok-Dashboard eine kostenlose Static-Domain reservieren:
    1. https://dashboard.ngrok.com/domains
    2. „New Domain" → es wird automatisch eine *.ngrok-free.app vergeben.
    3. Die volle Domain (z.B. dein-name.ngrok-free.app) kopieren.
`)
  await pause('Wenn fertig: ENTER drücken.')
  const ngrokDomain = await ask('NGROK_DOMAIN (ohne https://)')

  // 5) Lokale TwitchAddon/.env beschreiben — die EXE liest sie zur Laufzeit
  const addonEnv = join(__dir, 'TwitchAddon', '.env')
  if (existsSync(join(__dir, 'TwitchAddon'))) {
    upsertEnv(addonEnv, 'NGROK_AUTHTOKEN', ngrokToken)
    upsertEnv(addonEnv, 'NGROK_DOMAIN', ngrokDomain)
    console.log('    ✅ TwitchAddon/.env mit ngrok-Werten aktualisiert')
  }

  // 6) GitHub-Secrets setzen (für den CI-Build der EXE-Pipeline)
  setGhSecret('NGROK_AUTHTOKEN', ngrokToken)
  setGhSecret('NGROK_DOMAIN', ngrokDomain)

  // 7) Optional: Twitch-Extension einrichten
  if (await askYesNo('Auch die Twitch-Extension (Panel) einrichten?', false)) {
    console.log(`
    1. Browser:  https://dev.twitch.tv/console/extensions
    2. „Create Extension" → Typ Panel.
    3. „Testing Base URI":  https://${ngrokDomain}
    4. Pfade eintragen:
         Panel Viewer Path:  /extension/panel.html
         Config Path:        /extension/config.html
         Mobile Path:        /extension/mobile.html
    5. „Capabilities" → „Allowlist for URLs Fetched by the Frontend":
         https://${ngrokDomain}
    6. Im erstellten Extension-Dashboard die  Client ID  und das  Secret  notieren.
`)
    await pause('Wenn fertig: ENTER drücken.')
    const extId     = await ask('EXTENSION_CLIENT_ID')
    const extSecret = await ask('EXTENSION_SECRET (Base64)')
    if (existsSync(join(__dir, 'TwitchAddon'))) {
      upsertEnv(addonEnv, 'EXTENSION_CLIENT_ID', extId)
      upsertEnv(addonEnv, 'EXTENSION_SECRET', extSecret)
    }
    setGhSecret('EXTENSION_CLIENT_ID', extId)
    setGhSecret('EXTENSION_SECRET', extSecret)
    summary.done.push('TwitchAddon + Extension: ngrok-CLI konfiguriert, Secrets gesetzt, TwitchAddon/.env befüllt')
  } else {
    summary.done.push('TwitchAddon: ngrok-CLI konfiguriert, Secrets gesetzt, TwitchAddon/.env befüllt')
  }
}

async function setupDiscordBot(ghRepo: { owner: string; repo: string } | null): Promise<void> {
  if (!await askYesNo('Discord-Bot (Voting-Benachrichtigungen) jetzt einrichten?', false)) {
    summary.remaining.push('Discord-Bot optional – siehe SETUP.md Anhang C')
    return
  }
  header('5b) Discord-Bot — Schritt 1: Token + Channel-ID')
  console.log(`  Step-by-Step:

    1. Browser:  https://discord.com/developers/applications
    2. „New Application" → Name vergeben → Create.
    3. Sidebar „Bot" → „Add Bot" → bestätigen.
    4. „Privileged Gateway Intents":
         ✓ Server Members Intent
         ✓ Message Content Intent
    5. „Reset Token" → den neuen Token kopieren.
    6. Sidebar „OAuth2" → „URL Generator":
         Scopes:        bot
         Bot Permissions: Send Messages, View Channels
         → URL kopieren, im Browser öffnen, Bot in deinen Server einladen.
    7. In deinem Discord-Server: Rechtsklick auf den Ziel-Kanal
       → „Kanal-ID kopieren" (Entwicklermodus muss aktiv sein:
        Discord-Einstellungen → Erweitert → Entwicklermodus).
`)
  await pause('Wenn fertig: ENTER drücken.')
  const dcToken   = await ask('DISCORD_TOKEN')
  const dcChannel = await ask('CHANNEL_ID (Discord-Kanal)')

  // Lokale .env aktualisieren — für Dev-Läufe von DiscordBot
  const botEnv = join(__dir, 'DiscordBot', '.env')
  if (existsSync(join(__dir, 'DiscordBot'))) {
    upsertEnv(botEnv, 'DISCORD_TOKEN', dcToken)
    upsertEnv(botEnv, 'CHANNEL_ID', dcChannel)
    console.log('    ✅ DiscordBot/.env mit Discord-Werten aktualisiert')
  }

  // ── Render Deploy ──────────────────────────────────────────────────────────
  header('5b) Discord-Bot — Schritt 2: Render-Deploy')

  if (!ghRepo) {
    console.log(`  Kein GitHub-Repo bekannt → manuelles Render-Setup:

    1. Browser:  https://render.com  → Account → „New Web Service".
    2. Verbinde dein GitHub-Repo → Root Directory: „DiscordBot".
    3. Build:  npm install     Start: npm start
    4. Env-Variablen setzen:
         DISCORD_TOKEN              = ${dcToken}
         CHANNEL_ID                 = ${dcChannel}
         SUPABASE_SERVICE_ROLE_KEY  = (gleicher Wert wie in den GitHub-Secrets)
`)
    summary.remaining.push('Discord-Bot: Render-Deploy manuell (kein GitHub-Repo verbunden)')
  } else {
    const repoUrl   = `https://github.com/${ghRepo.owner}/${ghRepo.repo}`
    const deployUrl = `https://render.com/deploy?repo=${encodeURIComponent(repoUrl)}`
    console.log(`  Dank ${ghRepo.repo}/render.yaml ist das Render-Setup ein Klick:

    1. Öffne im Browser:
         ${deployUrl}

       (Render erkennt automatisch die render.yaml im Repo und legt den
       Web-Service „discord-bot" auf dem Free-Plan an.)

    2. Klicke „Connect" / „Authorize" wenn Render nach GitHub-Zugriff fragt.

    3. Trage die drei Werte ein, wenn Render danach fragt:

         DISCORD_TOKEN              = ${dcToken}
         CHANNEL_ID                 = ${dcChannel}
         SUPABASE_SERVICE_ROLE_KEY  = (siehe deine Supabase-API-Settings —
                                       derselbe Wert wie das GitHub-Secret)

    4. „Apply" / „Create new resources" klicken.
       Erster Deploy dauert ~2 Minuten.

    5. Render zeigt dir am Ende die Service-URL
       (z.B. https://discord-bot-xyz.onrender.com).
`)
    await pause('Wenn der Deploy auf Render läuft: ENTER drücken.')
  }

  // ── Supabase-Webhooks zur Bot-URL ──────────────────────────────────────────
  header('5b) Discord-Bot — Schritt 3: Supabase-Webhooks')
  const renderUrl = await ask('Render-Service-URL (z.B. https://discord-bot-xyz.onrender.com, leer = überspringen)', '')

  if (renderUrl) {
    console.log(`
  In deinem Supabase-Projekt:

    1. Sidebar → „Database" → „Webhooks" → „Create a new hook".
    2. Lege diese vier Hooks an (jeder mit Methode POST, Header
       „x-api-key" = dein SUPABASE_SERVICE_ROLE_KEY):

       ┌──────────────────────────┬───────────────────────────────────────┐
       │ Event                    │ Webhook-URL                           │
       ├──────────────────────────┼───────────────────────────────────────┤
       │ voting_rounds INSERT     │ ${renderUrl}/start-runde-1            │
       │ voting_rounds UPDATE → 2 │ ${renderUrl}/start-runde-2            │
       │ voting_rounds UPDATE → 3 │ ${renderUrl}/start-yearly             │
       │ voting_rounds UPDATE → 4 │ ${renderUrl}/end-runde                │
       └──────────────────────────┴───────────────────────────────────────┘

    (Die exakten Endpoint-Namen findest du in DiscordBot/index.ts —
    sie kommen aus dem RoundEndpoint-Type.)
`)
    await pause('Wenn die Webhooks angelegt sind: ENTER drücken.')
    summary.done.push(`Discord-Bot: Render-Service unter ${renderUrl}, Webhooks konfiguriert`)
  } else {
    summary.remaining.push('Discord-Bot: Supabase-Webhooks nachholen, sobald die Render-URL bekannt ist')
    summary.done.push('Discord-Bot: Token + Channel-ID konfiguriert, Deploy-URL ausgegeben')
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// PHASE 6: BILDER-CHECK (interaktiv)
// ═════════════════════════════════════════════════════════════════════════════

interface ImageTarget {
  path: string
  purpose: string
  format: string
}

/**
 * Baut die Image-Target-Liste – das Donation-Logo richtet sich nach
 * dem im Setup gewählten Provider (z.B. /img/logos/Kofi.webp).
 * Wenn keine `base` übergeben wird (Phase-Re-Run), werden die Werte
 * aus siteConfig.ts gelesen.
 */
function buildImageTargets(base?: BaseData): ImageTarget[] {
  let donationLogo = base?.donationLogo
  let donationProvider = base?.donationProvider
  if (!donationLogo || !donationProvider) {
    try {
      const cfg = readFileSync(configPath(), 'utf-8')
      const block = cfg.match(/streamelements:\s*\{([\s\S]*?)}/)?.[1] ?? ''
      donationLogo    = donationLogo    || block.match(/logoUrl:\s*'([^']+)'/)?.[1] || '/img/logos/StreamElements.webp'
      donationProvider = donationProvider || block.match(/label:\s*'([^']+)'/)?.[1]   || 'StreamElements'
    } catch {
      donationLogo = donationLogo || '/img/logos/StreamElements.webp'
      donationProvider = donationProvider || 'StreamElements'
    }
  }
  const donationLogoPath = donationLogo.replace(/^\//, '')
  return [
    { path: 'public/img/logos/HDProfile.webp',  purpose: 'Profilbild auf der Startseite',         format: 'WebP, quadratisch ~512×512' },
    { path: 'public/img/logos/OB.webp',         purpose: 'Logo des Premium-Bereichs (OnlyBart)',  format: 'WebP, quadratisch ~512×512' },
    { path: 'public/img/logo128.png',           purpose: 'Favicon / App-Icon',                    format: 'PNG, 128×128' },
    { path: 'public/img/logos/StreamPlan.webp', purpose: 'Karte „Streamplan" (Startseite)',       format: 'WebP, ~512×512' },
    { path: `public/${donationLogoPath}`,       purpose: `Karte „Donations" (${donationProvider})`, format: 'WebP, ~512×512' },
    { path: 'public/img/logos/cdm.webp',        purpose: 'Karte „Clip des Monats"',               format: 'WebP, ~512×512' },
  ]
}

async function imageChecklist(base?: BaseData): Promise<void> {
  header('6) Bilder ersetzen')
  console.log(`  Diese Default-Dateien gehören dem alten Streamer (HD1920x1080).
  Ersetze sie durch deine eigenen, indem du sie unter dem exakt gleichen
  Dateinamen + Format überschreibst. Wir gehen sie der Reihe nach durch.\n`)

  const targets = buildImageTargets(base)
  const remaining: ImageTarget[] = []
  for (const t of targets) {
    const abs = join(__dir, t.path)
    console.log(`  • ${t.path}`)
    console.log(`      Verwendung: ${t.purpose}`)
    console.log(`      Empfohlen:  ${t.format}`)
    console.log(`      Pfad:       ${abs}`)
    const exists = existsSync(abs)
    if (!exists) {
      console.log(`      ⚠  Datei existiert NICHT – muss neu angelegt werden.`)
      remaining.push(t)
      console.log('')
      continue
    }
    const replaced = await askYesNo('      Schon durch deine eigene Datei ersetzt?', false)
    if (!replaced) remaining.push(t)
    console.log('')
  }

  if (remaining.length === 0) {
    summary.done.push('Bilder: alle ersetzt')
  } else {
    summary.remaining.push(`Bilder ersetzen (${remaining.length} Datei(en) noch offen):`)
    for (const t of remaining) {
      summary.remaining.push(`    • ${join(__dir, t.path)}`)
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// FINAL-REPORT
// ═════════════════════════════════════════════════════════════════════════════

function finalReport(): void {
  console.log(`
┌─────────────────────────────────────────────────────────┐
│  🎉 Setup abgeschlossen!                                  │
└─────────────────────────────────────────────────────────┘
`)
  if (summary.done.length) {
    console.log('  ✅ Erledigt:')
    for (const item of summary.done) console.log('     • ' + item)
  }
  if (summary.remaining.length) {
    console.log('\n  ⚠️  Noch zu tun (manuell):')
    for (const item of summary.remaining) console.log('     • ' + item)
  }
  console.log(`
  📖 Detail-Doku: SETUP.md
  ▶️  Lokal starten: npm install && npm run dev
`)
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN — Phasen-Menü + Einstiegspunkt
// ═════════════════════════════════════════════════════════════════════════════

type Phase =
  | 'all'
  | 'base'
  | 'lists'
  | 'twitch-supabase-github'
  | 'twitchaddon'
  | 'discord'
  | 'images'

/**
 * Heuristik: gilt das Repo schon als „erstmals konfiguriert"?
 * Wenn die Default-Werte aus dem Original-Streamer in siteConfig.ts nicht mehr
 * stehen ODER eine .env vorhanden ist, war das Setup schon mindestens einmal dran.
 */
function isAlreadyConfigured(): boolean {
  if (existsSync(join(__dir, '.env'))) return true
  try {
    const cfg = readFileSync(configPath(), 'utf-8')
    return !cfg.includes(`name: 'HD1920x1080',`)
  } catch { return false }
}

async function choosePhase(): Promise<Phase> {
  console.log(`
  Was möchtest du tun?
    1) Komplettes Setup (alles der Reihe nach)        [Default]
    2) Nur Basisdaten (Kanal, Profil, Impressum, Akzentfarbe, Donation, Kalender)
    3) Nur Listen & Inhalte (Links, Games, Clips, Partner, Redirects, Streamplan)
    4) Nur Twitch-App + Supabase + GitHub (Repo, Secrets, Pages)
    5) Nur TwitchAddon (ngrok + Extension)
    6) Nur Discord-Bot
    7) Nur Bilder-Check
    0) Beenden
`)
  const choice = await askNumber('Auswahl', 1, 0)
  const map: Record<number, Phase> = {
    1: 'all',
    2: 'base',
    3: 'lists',
    4: 'twitch-supabase-github',
    5: 'twitchaddon',
    6: 'discord',
    7: 'images',
  }
  if (choice === 0) { console.log('\n  Setup beendet.'); rl.close(); process.exit(0) }
  return map[choice] ?? 'all'
}

/** Twitch+Supabase+GitHub als zusammenhängender Block (auch standalone wiederholbar). */
async function runRemotePhase(channelName: string): Promise<{ owner: string; repo: string } | null> {
  const twitch   = await twitchAppWalkthrough()
  const supabase = await supabaseWalkthrough(twitch)

  const envPath = join(__dir, '.env')
  upsertEnv(envPath, 'VITE_SUPABASE_URL', supabase.url)
  upsertEnv(envPath, 'VITE_SUPABASE_ANON_KEY', supabase.anonKey)
  upsertEnv(envPath, 'VITE_TWITCH_CLIENT_ID', twitch.clientId)
  if (channelName) upsertEnv(envPath, 'VITE_CHANNEL_NAME', channelName)
  console.log('  ✅ .env mit Supabase- und Twitch-Werten aktualisiert')
  summary.done.push('.env mit Supabase + Twitch Werten befüllt')

  return runGitHubPhase({ twitch, supabase, channelName })
}

/** Liest VITE_CHANNEL_NAME aus .env (für Re-Runs, in denen Phase 1 übersprungen wurde). */
function readChannelFromEnv(): string {
  const envPath = join(__dir, '.env')
  if (!existsSync(envPath)) return ''
  return readFileSync(envPath, 'utf-8').match(/^VITE_CHANNEL_NAME=(.*)$/m)?.[1].trim() ?? ''
}

async function main(): Promise<void> {
  console.log('\n┌─────────────────────────────────────────────────────────┐')
  console.log('│  🛠️   Twitch Landing Page – Setup-Assistent              │')
  console.log('└─────────────────────────────────────────────────────────┘')

  await bootstrap(__dir)

  // Erstinstallation → direkt voller Flow; spätere Läufe → Menü.
  const phase: Phase = isAlreadyConfigured() ? await choosePhase() : 'all'

  let base: BaseData | null = null
  let ghRepo: { owner: string; repo: string } | null = null

  if (phase === 'all' || phase === 'base') {
    base = await askBaseData()
    applyBaseData(base)
  }

  if (phase === 'all' || phase === 'lists') {
    await runListPhase()
  }

  if (phase === 'all') {
    if (await askYesNo('\nJetzt Twitch-App + Supabase-Projekt einrichten? (kann später wiederholt werden)', true)) {
      ghRepo = await runRemotePhase(base?.channelName ?? readChannelFromEnv())
    } else {
      summary.remaining.push('Twitch-App + Supabase + GitHub-Secrets nachholen (Setup erneut starten → Option 4)')
    }
  } else if (phase === 'twitch-supabase-github') {
    ghRepo = await runRemotePhase(base?.channelName ?? readChannelFromEnv())
  }

  if (phase === 'all' || phase === 'twitchaddon') {
    await setupTwitchAddon()
  }

  if (phase === 'all' || phase === 'discord') {
    await setupDiscordBot(ghRepo)
  }

  if (phase === 'all' || phase === 'images') {
    await imageChecklist(base ?? undefined)
  }

  rl.close()
  finalReport()
}

main().catch((err: unknown) => { console.error(err); process.exit(1) })
