import { describe, it, expect } from 'vitest'
import {
  buildRoundMessage,
  isAuthorized,
  parsePort,
  VOTING_URL,
  type RoundEndpoint,
} from './lib'

describe('buildRoundMessage', () => {
  const cases: Array<{ endpoint: RoundEndpoint; needle: string }> = [
    { endpoint: 'start-runde-1', needle: 'Runde 1 hat begonnen' },
    { endpoint: 'ende-runde-1',  needle: 'Runde 1 ist beendet' },
    { endpoint: 'start-runde-2', needle: 'Runde 2 startet jetzt' },
    { endpoint: 'ende-runde-2',  needle: 'Runde 2 ist vorbei' },
    { endpoint: 'start-jahr',    needle: 'Clip des Jahres Voting beginnt' },
    { endpoint: 'ende-jahr',     needle: 'Voting ist abgeschlossen' },
  ]

  for (const { endpoint, needle } of cases) {
    it(`enthält den passenden Hinweistext für ${endpoint}`, () => {
      const message = buildRoundMessage(endpoint)
      expect(message).toContain(needle)
      expect(message).toContain(VOTING_URL)
    })
  }

  it('enthält die Voting-URL in jeder Nachricht', () => {
    const endpoints: RoundEndpoint[] = [
      'start-runde-1', 'ende-runde-1',
      'start-runde-2', 'ende-runde-2',
      'start-jahr',    'ende-jahr',
    ]
    for (const endpoint of endpoints) {
      expect(buildRoundMessage(endpoint)).toContain('https://hd1920x1080.de/clipdesmonats')
    }
  })

  it('liefert eindeutige Texte pro Endpunkt', () => {
    const endpoints: RoundEndpoint[] = [
      'start-runde-1', 'ende-runde-1',
      'start-runde-2', 'ende-runde-2',
      'start-jahr',    'ende-jahr',
    ]
    const messages = endpoints.map(buildRoundMessage)
    expect(new Set(messages).size).toBe(messages.length)
  })
})

describe('isAuthorized', () => {
  it('akzeptiert exakt passenden Key', () => {
    expect(isAuthorized('secret-123', 'secret-123')).toBe(true)
  })

  it('lehnt abweichenden Key ab', () => {
    expect(isAuthorized('wrong', 'secret-123')).toBe(false)
  })

  it('lehnt fehlenden Header ab', () => {
    expect(isAuthorized(undefined, 'secret-123')).toBe(false)
  })

  it('lehnt nicht-string Header ab (Array)', () => {
    expect(isAuthorized(['secret-123'], 'secret-123')).toBe(false)
  })

  it('lehnt leeren Erwartungs-Key ab — verhindert Bypass bei fehlender Konfiguration', () => {
    expect(isAuthorized('', '')).toBe(false)
    expect(isAuthorized('beliebig', undefined)).toBe(false)
  })

  it('case-sensitive', () => {
    expect(isAuthorized('SECRET', 'secret')).toBe(false)
  })
})

describe('parsePort', () => {
  it('liest gültige Port-Strings', () => {
    expect(parsePort('8080')).toBe(8080)
    expect(parsePort('1')).toBe(1)
    expect(parsePort('65535')).toBe(65535)
  })

  it('fällt bei undefined auf den Default zurück', () => {
    expect(parsePort(undefined)).toBe(3000)
  })

  it('fällt bei nicht-numerischem String auf den Default zurück', () => {
    expect(parsePort('abc')).toBe(3000)
    expect(parsePort('')).toBe(3000)
  })

  it('fällt bei Werten außerhalb des Port-Bereichs auf den Default zurück', () => {
    expect(parsePort('0')).toBe(3000)
    expect(parsePort('-5')).toBe(3000)
    expect(parsePort('99999')).toBe(3000)
  })

  it('akzeptiert benutzerdefinierten Fallback', () => {
    expect(parsePort(undefined, 4000)).toBe(4000)
    expect(parsePort('abc', 4000)).toBe(4000)
  })
})
