import { describe, it, expect } from 'vitest'
import {
  b64urlToBuffer,
  b64urlToString,
  buildDescription,
  corsHeaders,
  queryParam,
  resolveTts,
  resolveUserIdFromJwt,
} from './serverHelpers'

describe('b64urlToBuffer / b64urlToString', () => {
  it('dekodiert base64url ohne Padding', () => {
    expect(b64urlToString('SGVsbG8')).toBe('Hello')
  })

  it('dekodiert base64url mit URL-spezifischen Zeichen (-, _)', () => {
    const encoded = Buffer.from('?>hello/world+').toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(b64urlToString(encoded)).toBe('?>hello/world+')
  })

  it('liefert ein Uint8Array mit den richtigen Bytes', () => {
    const buf = b64urlToBuffer('SGVsbG8')
    expect(Array.from(buf)).toEqual([72, 101, 108, 108, 111])
  })
})

describe('resolveUserIdFromJwt', () => {
  it('liest user_id aus dem Payload', () => {
    expect(resolveUserIdFromJwt({ user_id: '12345' })).toBe('12345')
  })

  it('liefert null wenn user_id fehlt', () => {
    expect(resolveUserIdFromJwt({})).toBeNull()
  })

  it('liefert null bei null-Payload', () => {
    expect(resolveUserIdFromJwt(null)).toBeNull()
  })

  it('liefert null wenn user_id nicht-string ist', () => {
    expect(resolveUserIdFromJwt({ user_id: 12345 })).toBeNull()
    expect(resolveUserIdFromJwt({ user_id: null })).toBeNull()
  })

  it('liefert null bei leerem user_id-String', () => {
    expect(resolveUserIdFromJwt({ user_id: '' })).toBeNull()
  })
})

function makeRequest(origin?: string): Request {
  const headers = new Headers()
  if (origin !== undefined) headers.set('Origin', origin)
  return new Request('https://example.com/test', { headers })
}

describe('corsHeaders', () => {
  it('spiegelt twitch.tv-Origin', () => {
    const headers = corsHeaders(makeRequest('https://www.twitch.tv'))
    expect(headers['Access-Control-Allow-Origin']).toBe('https://www.twitch.tv')
  })

  it('spiegelt ext-twitch.tv-Origin', () => {
    const headers = corsHeaders(makeRequest('https://abc.ext-twitch.tv'))
    expect(headers['Access-Control-Allow-Origin']).toBe('https://abc.ext-twitch.tv')
  })

  it('fällt auf Supervisor zurück bei fremder Origin', () => {
    const headers = corsHeaders(makeRequest('https://evil.example.com'))
    expect(headers['Access-Control-Allow-Origin']).toBe('https://supervisor.ext-twitch.tv')
  })

  it('fällt auf Supervisor zurück bei fehlender Origin', () => {
    const headers = corsHeaders(makeRequest())
    expect(headers['Access-Control-Allow-Origin']).toBe('https://supervisor.ext-twitch.tv')
  })

  it('erlaubt nötige Methoden und Header', () => {
    const headers = corsHeaders(makeRequest('https://www.twitch.tv'))
    expect(headers['Access-Control-Allow-Methods']).toContain('POST')
    expect(headers['Access-Control-Allow-Methods']).toContain('DELETE')
    expect(headers['Access-Control-Allow-Methods']).toContain('OPTIONS')
    expect(headers['Access-Control-Allow-Headers']).toContain('x-extension-jwt')
    expect(headers.Vary).toBe('Origin')
  })

  it('akzeptiert keine Origin, die nur als Substring twitch.tv enthält', () => {
    const headers = corsHeaders(makeRequest('https://twitch.tv.evil.com'))
    expect(headers['Access-Control-Allow-Origin']).toBe('https://supervisor.ext-twitch.tv')
  })
})

describe('queryParam', () => {
  it('liest einen vorhandenen Parameter', () => {
    expect(queryParam(new URL('https://x/y?id=42'), 'id')).toBe('42')
  })

  it('liefert null bei fehlendem Parameter', () => {
    expect(queryParam(new URL('https://x/y'), 'id')).toBeNull()
  })

  it('dekodiert URL-Codierung', () => {
    expect(queryParam(new URL('https://x/y?text=Hello%20World'), 'text')).toBe('Hello World')
  })

  it('liefert leeren String wenn Parameter explizit leer', () => {
    expect(queryParam(new URL('https://x/y?id='), 'id')).toBe('')
  })
})

describe('buildDescription', () => {
  it('liefert leeren String, wenn weder description noch text gesetzt', () => {
    expect(buildDescription({}, null, 'user1')).toBe('')
  })

  it('liefert nur description bei nicht-TTS-Reward', () => {
    expect(buildDescription({ description: 'Hallo' }, 'sollte ignoriert werden', 'user1')).toBe('Hallo')
  })

  it('ersetzt %name% mit der userId', () => {
    expect(buildDescription({ description: 'Willkommen %name%!' }, null, 'tester')).toBe('Willkommen tester!')
  })

  it('TTS mit festem text: nutzt nur den text aus der DB', () => {
    expect(buildDescription({ istts: true, text: 'fester Spruch' }, 'beliebig', 'user1'))
      .toBe('fester Spruch')
  })

  it('TTS ohne text aber mit description und ttsText: kombiniert beide', () => {
    expect(buildDescription({ istts: true, description: 'Sagt:' }, 'Hallo Welt', 'user1'))
      .toBe('Sagt: Hallo Welt')
  })

  it('TTS ohne text und ohne ttsText: nutzt description', () => {
    expect(buildDescription({ istts: true, description: 'Standard' }, null, 'user1'))
      .toBe('Standard')
  })

  it('TTS ohne description: nutzt ttsText', () => {
    expect(buildDescription({ istts: true }, 'nur TTS', 'user1')).toBe('nur TTS')
  })

  it('TTS ganz leer: liefert leeren String', () => {
    expect(buildDescription({ istts: true }, null, 'user1')).toBe('')
  })

  it('ersetzt %name% auch im TTS-Text', () => {
    expect(buildDescription({ istts: true, description: 'Hi %name%' }, 'foo', 'user42'))
      .toBe('Hi user42 foo')
  })
})

describe('resolveTts', () => {
  it('liefert null bei nicht-TTS-Reward', () => {
    expect(resolveTts({ description: 'foo' }, 'wird ignoriert')).toBeNull()
  })

  it('liefert null bei TTS mit fest hinterlegtem text', () => {
    expect(resolveTts({ istts: true, text: 'fest' }, 'frei')).toBeNull()
  })

  it('liefert ttsText bei TTS ohne festen text', () => {
    expect(resolveTts({ istts: true }, 'free input')).toBe('free input')
  })

  it('liefert null wenn ttsText leer', () => {
    expect(resolveTts({ istts: true }, '')).toBeNull()
    expect(resolveTts({ istts: true }, null)).toBeNull()
  })
})
