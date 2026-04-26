/**
 * Architektur-Tests (ArchUnit-Stil).
 *
 * Diese Tests erzwingen Schichtgrenzen im Quellbaum,
 * damit Abhängigkeiten nicht im Laufe der Zeit verletzt werden:
 *
 *   pages  →  components  →  context / hooks  →  lib
 *
 * Geprüfte Regeln:
 *   1. `lib/` darf nicht aus `components/`, `pages/`, `context/` oder `hooks/` importieren.
 *   2. `context/` darf nicht aus `components/` oder `pages/` importieren.
 *   3. `hooks/` darf nicht aus `components/` oder `pages/` importieren.
 *   4. `components/` darf nicht aus `pages/` importieren.
 *   5. Kein Quell-Datei außerhalb von `test/` importiert aus dem `test/`-Verzeichnis.
 */

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve(__dirname, '..')

/** Alle .ts/.tsx-Dateien unter `dir` rekursiv sammeln. */
function filesIn(dir: string): string[] {
  const results: string[] = []
  const fullDir = path.join(SRC, dir)
  if (!fs.existsSync(fullDir)) return results

  function walk(current: string) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        results.push(full)
      }
    }
  }

  walk(fullDir)
  return results
}

/** Alle Import-Pfade einer Datei zurückgeben. */
function importsOf(file: string): string[] {
  const content = fs.readFileSync(file, 'utf-8')
  const re = /from\s+['"]([^'"]+)['"]/g
  const results: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    results.push(m[1])
  }
  return results
}

/** Wahr, wenn mindestens ein Import in `file` auf `pattern` passt. */
function importsMatch(file: string, pattern: RegExp): boolean {
  return importsOf(file).some((imp) => pattern.test(imp))
}

// ---------------------------------------------------------------------------

describe('Architecture: layer boundary rules', () => {
  it('lib/ must not import from components/, pages/, context/, or hooks/', () => {
    const violations: string[] = []
    for (const file of filesIn('lib')) {
      if (importsMatch(file, /\/(components|pages|context|hooks)\//)) {
        violations.push(path.relative(SRC, file))
      }
    }
    expect(violations, `Violations: ${violations.join(', ')}`).toHaveLength(0)
  })

  it('context/ must not import from components/ or pages/', () => {
    const violations: string[] = []
    for (const file of filesIn('context')) {
      if (importsMatch(file, /\/(components|pages)\//)) {
        violations.push(path.relative(SRC, file))
      }
    }
    expect(violations, `Violations: ${violations.join(', ')}`).toHaveLength(0)
  })

  it('hooks/ must not import from components/ or pages/', () => {
    const violations: string[] = []
    for (const file of filesIn('hooks')) {
      if (importsMatch(file, /\/(components|pages)\//)) {
        violations.push(path.relative(SRC, file))
      }
    }
    expect(violations, `Violations: ${violations.join(', ')}`).toHaveLength(0)
  })

  it('components/ must not import from pages/', () => {
    const violations: string[] = []
    for (const file of filesIn('components')) {
      if (importsMatch(file, /\/pages\//)) {
        violations.push(path.relative(SRC, file))
      }
    }
    expect(violations, `Violations: ${violations.join(', ')}`).toHaveLength(0)
  })

  it('non-test source files must not import from test/', () => {
    // Alle .ts/.tsx unter src/ sammeln, außer src/test/ und *.test.{ts,tsx}
    const allSrc: string[] = []
    const layers = ['lib', 'components', 'pages', 'context', 'hooks', 'config', 'i18n', 'types']
    for (const layer of layers) {
      allSrc.push(...filesIn(layer).filter((f) => !/\.test\.(ts|tsx)$/.test(f)))
    }
    // Auch Top-Level-src-Dateien einbeziehen (keine Test-Dateien)
    for (const entry of fs.readdirSync(SRC, { withFileTypes: true })) {
      if (
        !entry.isDirectory() &&
        /\.(ts|tsx)$/.test(entry.name) &&
        !/\.test\.(ts|tsx)$/.test(entry.name)
      ) {
        allSrc.push(path.join(SRC, entry.name))
      }
    }

    const violations: string[] = []
    for (const file of allSrc) {
      if (importsMatch(file, /\/test\//)) {
        violations.push(path.relative(SRC, file))
      }
    }
    expect(violations, `Violations: ${violations.join(', ')}`).toHaveLength(0)
  })
})
