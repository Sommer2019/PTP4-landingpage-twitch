#!/usr/bin/env npx tsx
/**
 * Automatische JSON-Übersetzung via DeepL Free API.
 *
 * Aufruf:
 *   npm run translate -- fr es ja
 *   DEEPL_API_KEY=xxx npx tsx scripts/translate.ts fr es
 *
 * DEEPL_API_KEY kann auch in .env.local gesetzt werden.
 * Kostenlosen Key: https://www.deepl.com/de/pro-api (500k Zeichen/Monat)
 *
 * Optionen:
 *   --force     Bereits vorhandene JSON-Dateien überschreiben
 *   --dry-run   Vorschau ohne Dateien zu schreiben
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// ── Sprachdaten (Flag + nativer Name) ────────────────────────────────────────

const LANGUAGE_INFO: Record<string, { native: string; flag: string }> = {
  af: { native: 'Afrikaans',          flag: '🇿🇦' },
  ar: { native: 'العربية',            flag: '🇸🇦' },
  bg: { native: 'Български',          flag: '🇧🇬' },
  cs: { native: 'Čeština',            flag: '🇨🇿' },
  da: { native: 'Dansk',              flag: '🇩🇰' },
  el: { native: 'Ελληνικά',          flag: '🇬🇷' },
  en: { native: 'English',            flag: '🇬🇧' },
  es: { native: 'Español',            flag: '🇪🇸' },
  et: { native: 'Eesti',              flag: '🇪🇪' },
  fi: { native: 'Suomi',              flag: '🇫🇮' },
  fr: { native: 'Français',           flag: '🇫🇷' },
  hu: { native: 'Magyar',             flag: '🇭🇺' },
  id: { native: 'Bahasa Indonesia',   flag: '🇮🇩' },
  it: { native: 'Italiano',           flag: '🇮🇹' },
  ja: { native: '日本語',             flag: '🇯🇵' },
  ko: { native: '한국어',             flag: '🇰🇷' },
  lt: { native: 'Lietuvių',           flag: '🇱🇹' },
  lv: { native: 'Latviešu',           flag: '🇱🇻' },
  nl: { native: 'Nederlands',         flag: '🇳🇱' },
  no: { native: 'Norsk',              flag: '🇳🇴' },
  pl: { native: 'Polski',             flag: '🇵🇱' },
  pt: { native: 'Português',          flag: '🇵🇹' },
  ro: { native: 'Română',             flag: '🇷🇴' },
  ru: { native: 'Русский',            flag: '🇷🇺' },
  sk: { native: 'Slovenčina',         flag: '🇸🇰' },
  sl: { native: 'Slovenščina',        flag: '🇸🇮' },
  sv: { native: 'Svenska',            flag: '🇸🇪' },
  tr: { native: 'Türkçe',             flag: '🇹🇷' },
  uk: { native: 'Українська',        flag: '🇺🇦' },
  zh: { native: '中文 (简体)',         flag: '🇨🇳' },
}

// Diese Pfade werden NICHT übersetzt (reine Abkürzungen/Kürzel)
const SKIP_PATHS = new Set(['bartclicker.unitArray'])

// ── .env.local laden ─────────────────────────────────────────────────────────

function loadEnvLocal() {
  const envPath = join(ROOT, '.env.local')
  if (!existsSync(envPath)) return
  readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const m = line.match(/^([A-Z_]+)\s*=\s*(.*)$/)
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  })
}

// ── i18next-Interpolationsvariablen schützen ─────────────────────────────────

function protectVars(text: string): { safe: string; map: string[] } {
  const map: string[] = []
  const safe = text.replace(/\{\{[^}]+\}\}/g, match => {
    map.push(match)
    return `__TVar${map.length - 1}__`
  })
  return { safe, map }
}

function restoreVars(text: string, map: string[]): string {
  return text.replace(/__TVar(\d+)__/g, (_, i) => map[Number(i)] ?? _)
}

// ── JSON-Traversierung ───────────────────────────────────────────────────────

type Entry = { path: string; safe: string; varMap: string[] }

function collectStrings(value: unknown, path: string): Entry[] {
  if (typeof value === 'string') {
    if (!value.trim()) return []
    const { safe, map } = protectVars(value)
    return [{ path, safe, varMap: map }]
  }
  if (Array.isArray(value)) {
    if (SKIP_PATHS.has(path)) return []
    return value.flatMap((v, i) => collectStrings(v, `${path}[${i}]`))
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) =>
      collectStrings(v, path ? `${path}.${k}` : k)
    )
  }
  return []
}

// Wert tief in einem Objekt anhand eines Pfads setzen (mit Array-Index-Support)
function setDeep(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.')
  let cur: Record<string, unknown> = obj
  for (let i = 0; i < parts.length - 1; i++) {
    cur = cur[parts[i]] as Record<string, unknown>
  }
  cur[parts[parts.length - 1]] = value
}

// ── DeepL API ────────────────────────────────────────────────────────────────

async function translateBatch(texts: string[], targetLang: string, apiKey: string): Promise<string[]> {
  // Free-API-Keys enden auf ":fx", Pro-Keys nicht
  const endpoint = apiKey.endsWith(':fx')
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate'

  const body = new URLSearchParams({ target_lang: targetLang.toUpperCase(), source_lang: 'DE' })
  texts.forEach(t => body.append('text', t))

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  if (!res.ok) {
    throw new Error(`DeepL ${res.status}: ${await res.text()}`)
  }

  const data = (await res.json()) as { translations: { text: string }[] }
  return data.translations.map(t => t.text)
}

async function translateAll(entries: Entry[], targetLang: string, apiKey: string): Promise<Map<string, string>> {
  const BATCH_SIZE = 50
  const result = new Map<string, string>()

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE)
    const end = Math.min(i + BATCH_SIZE, entries.length)
    process.stdout.write(`  Übersetze ${i + 1}–${end} / ${entries.length} ...`)

    const translated = await translateBatch(batch.map(e => e.safe), targetLang, apiKey)
    batch.forEach((entry, j) => {
      result.set(entry.path, restoreVars(translated[j], entry.varMap))
    })

    console.log(' ✓')
    if (end < entries.length) await new Promise(r => setTimeout(r, 150))
  }

  return result
}

// ── i18n.ts patchen ──────────────────────────────────────────────────────────

function patchI18nTs(lang: string): void {
  const filePath = join(ROOT, 'src', 'i18n', 'i18n.ts')
  const lines = readFileSync(filePath, 'utf-8').split('\n')
  const varName = lang.replace('-', '_')

  if (lines.some(l => l.includes(`'./locales/${lang}.json'`))) return

  // Import nach dem letzten Locale-Import einfügen
  const lastImportIdx = lines.reduce((last, l, i) =>
    l.includes("from './locales/") ? i : last, -1)
  lines.splice(lastImportIdx + 1, 0, `import ${varName} from './locales/${lang}.json'`)

  // Resource-Eintrag nach dem letzten vorhandenen einfügen
  const lastResIdx = lines.reduce((last, l, i) =>
    /^\s+\w+: \{ translation: \w+ \},$/.test(l) ? i : last, -1)
  lines.splice(lastResIdx + 1, 0, `      ${varName}: { translation: ${varName} },`)

  // supportedLngs ergänzen
  const slIdx = lines.findIndex(l => l.includes('supportedLngs:'))
  if (slIdx >= 0) lines[slIdx] = lines[slIdx].replace(/\]/, `, '${lang}']`)

  writeFileSync(filePath, lines.join('\n'), 'utf-8')
  console.log('  ✓ src/i18n/i18n.ts aktualisiert')
}

// ── SettingsBar.tsx patchen ───────────────────────────────────────────────────

function patchSettingsBar(lang: string): void {
  const filePath = join(ROOT, 'src', 'components', 'SettingsBar', 'SettingsBar.tsx')
  const lines = readFileSync(filePath, 'utf-8').split('\n')
  const info = LANGUAGE_INFO[lang]

  if (lines.some(l => l.includes(`value="${lang}"`))) return

  if (!info) {
    console.warn(`  ⚠ Kein Flag/Name für "${lang}" bekannt — SettingsBar muss manuell ergänzt werden.`)
    return
  }

  // languageFlags: letzten Eintrag im Record finden und danach einfügen
  const lastFlagIdx = lines.reduce((last, l, i) =>
    /^\s+\w+: '/.test(l) && lines[i - 1]?.includes('languageFlags') || last >= 0 && /^\s+\w+: '/.test(l) ? i : last, -1)
  if (lastFlagIdx >= 0) {
    lines.splice(lastFlagIdx + 1, 0, `  ${lang}: '${info.flag}',`)
  }

  // langOrder: neuen Code in das as-const-Tupel einfügen
  const orderIdx = lines.findIndex(l => l.includes('const langOrder = ['))
  if (orderIdx >= 0) {
    lines[orderIdx] = lines[orderIdx].replace(/\] as const/, `, '${lang}'] as const`)
  }

  // getCurrentLang: neuen Branch vor dem abschließenden return einfügen
  const returnIdx = lines.findIndex((l, i) => i > 0 && l.trim().startsWith("return '") &&
    lines[i - 1]?.trim().startsWith('if (language'))
  if (returnIdx >= 0) {
    lines.splice(returnIdx, 0, `  if (language?.startsWith('${lang}')) return '${lang}'`)
  }

  // <select>: neue <option> vor </select> einfügen
  const selectCloseIdx = lines.findIndex(l => l.includes('</select>'))
  if (selectCloseIdx >= 0) {
    lines.splice(selectCloseIdx, 0,
      `          <option value="${lang}">${info.flag} ${info.native}</option>`)
  }

  writeFileSync(filePath, lines.join('\n'), 'utf-8')
  console.log('  ✓ src/components/SettingsBar/SettingsBar.tsx aktualisiert')
}

// ── Hauptprogramm ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  loadEnvLocal()

  const argv = process.argv.slice(2)
  const force = argv.includes('--force')
  const dryRun = argv.includes('--dry-run')
  const langs = argv.filter(a => !a.startsWith('--'))

  if (langs.length === 0) {
    console.error('Verwendung: npm run translate -- <lang1> [lang2] ...')
    console.error('Beispiel:   DEEPL_API_KEY=xxx npm run translate -- fr es ja')
    process.exit(1)
  }

  const apiKey = process.env.DEEPL_API_KEY ?? ''
  if (!apiKey) {
    console.error('❌  DEEPL_API_KEY fehlt.')
    console.error('    Kostenlosen Key registrieren: https://www.deepl.com/de/pro-api')
    console.error('    Dann in .env.local eintragen: DEEPL_API_KEY=xxxx:fx')
    process.exit(1)
  }

  const sourceJson = JSON.parse(readFileSync(join(ROOT, 'src/i18n/locales/de.json'), 'utf-8'))
  const entries = collectStrings(sourceJson, '')
  console.log(`📚 ${entries.length} übersetzbare Strings in de.json\n`)

  for (const lang of langs) {
    const outPath = join(ROOT, `src/i18n/locales/${lang}.json`)

    if (existsSync(outPath) && !force) {
      console.log(`⏭  ${lang}: ${outPath} existiert bereits (--force zum Überschreiben)`)
      continue
    }

    const displayName = LANGUAGE_INFO[lang]?.native ?? lang
    console.log(`🌍 ${lang} — ${displayName}`)

    const translations = await translateAll(entries, lang, apiKey)

    // Startet mit einer Kopie von de.json, überschreibt dann übersetzte Werte
    const result = JSON.parse(JSON.stringify(sourceJson)) as Record<string, unknown>
    for (const [path, translated] of translations) {
      setDeep(result, path, translated)
    }

    if (!dryRun) {
      writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n', 'utf-8')
      console.log(`  ✓ ${outPath} erstellt`)
      patchI18nTs(lang)
      patchSettingsBar(lang)
    } else {
      console.log(`  [dry-run] würde ${outPath} erstellen, i18n.ts + SettingsBar.tsx patchen`)
    }
    console.log()
  }

  console.log('✅ Fertig!')
}

main().catch(err => {
  console.error('❌', err instanceof Error ? err.message : err)
  process.exit(1)
})
