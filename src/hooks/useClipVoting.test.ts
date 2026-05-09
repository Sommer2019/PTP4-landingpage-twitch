import { describe, it, expect } from 'vitest'
import { derivePhase } from './useClipVoting'
import type { VotingRound, RoundType } from '../types/clipVoting'

function round(type: RoundType, status: VotingRound['status']): VotingRound {
  return {
    id: `${type}-${status}`,
    type,
    status,
    year: 2026,
    month: type === 'yearly' ? null : 5,
    starts_at: null,
    ends_at: null,
    created_at: '2026-05-09T00:00:00Z',
  }
}

describe('derivePhase', () => {
  it('keine Runde → no-round', () => {
    expect(derivePhase(null, null, null)).toBe('no-round')
  })

  it('aktive Runde 1 → round1-active', () => {
    expect(derivePhase(round('round1', 'active'), null, null)).toBe('round1-active')
  })

  it('aktive Runde 2 → round2-active', () => {
    expect(derivePhase(round('round2', 'active'), null, null)).toBe('round2-active')
  })

  it('aktives Yearly → yearly-active', () => {
    expect(derivePhase(round('yearly', 'active'), null, null)).toBe('yearly-active')
  })

  it('Runde 2 ausstehend (pending) → round1-results', () => {
    expect(derivePhase(null, round('round2', 'pending'), null)).toBe('round1-results')
  })

  it('andere pending-Variante (z.B. yearly pending) → no-round', () => {
    expect(derivePhase(null, round('yearly', 'pending'), null)).toBe('no-round')
  })

  it('nur abgeschlossene Runde 1 → round1-results', () => {
    expect(derivePhase(null, null, round('round1', 'completed'))).toBe('round1-results')
  })

  it('nur abgeschlossene Runde 2 → round2-results', () => {
    expect(derivePhase(null, null, round('round2', 'completed'))).toBe('round2-results')
  })

  it('nur abgeschlossenes Yearly → yearly-results', () => {
    expect(derivePhase(null, null, round('yearly', 'completed'))).toBe('yearly-results')
  })

  it('aktive Runde gewinnt vor pending', () => {
    expect(derivePhase(round('round2', 'active'), round('round1', 'pending'), null))
      .toBe('round2-active')
  })

  it('aktive Runde gewinnt vor completed', () => {
    expect(derivePhase(round('round1', 'active'), null, round('round2', 'completed')))
      .toBe('round1-active')
  })

  it('pending gewinnt vor completed', () => {
    expect(derivePhase(null, round('round2', 'pending'), round('round1', 'completed')))
      .toBe('round1-results')
  })
})
