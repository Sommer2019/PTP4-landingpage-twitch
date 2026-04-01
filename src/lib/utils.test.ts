import { describe, it, expect } from 'vitest'
import { getErrorMessage } from '../lib/utils'

describe('getErrorMessage', () => {
  it('returns string errors as-is', () => {
    expect(getErrorMessage('something went wrong')).toBe('something went wrong')
  })

  it('extracts message from Error objects', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom')
  })

  it('extracts message from plain objects with message property', () => {
    expect(getErrorMessage({ message: 'oops' })).toBe('oops')
  })

  it('returns fallback for null', () => {
    expect(getErrorMessage(null)).toBe('Unbekannter Fehler')
  })

  it('returns fallback for undefined', () => {
    expect(getErrorMessage(undefined)).toBe('Unbekannter Fehler')
  })

  it('returns fallback for numbers', () => {
    expect(getErrorMessage(42)).toBe('Unbekannter Fehler')
  })

  it('returns fallback when message property is not a string', () => {
    expect(getErrorMessage({ message: 123 })).toBe('Unbekannter Fehler')
  })

  it('returns fallback for empty object', () => {
    expect(getErrorMessage({})).toBe('Unbekannter Fehler')
  })
})
