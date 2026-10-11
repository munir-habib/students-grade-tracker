import { describe, expect, it } from 'vitest'

import { simulateTargetGrade } from './simulator'
import type { PointsModeTotals } from './types'

describe('simulateTargetGrade', () => {
  it('reports guaranteed when the target is already locked in', () => {
    const totals: PointsModeTotals = { earnedSum: 90, totalPossible: 100, completedPossibleSum: 90, percent: 90 }
    const result = simulateTargetGrade(totals, 'C')
    expect(result).toEqual({ kind: 'guaranteed', letter: 'C' })
  })

  it('reports the % needed on the remaining points when achievable', () => {
    const totals: PointsModeTotals = {
      earnedSum: 16,
      totalPossible: 47,
      completedPossibleSum: 23,
      percent: (16 / 47) * 100,
    }
    const result = simulateTargetGrade(totals, 'C') // C = 73%
    expect(result.kind).toBe('achievable')
    if (result.kind === 'achievable') {
      // needed = 0.73*47 - 16 = 18.31; remaining = 47-23 = 24 -> 76.29%
      expect(result.neededPercentOnRest).toBeCloseTo(76.29, 1)
    }
  })

  it('reports impossible with a ceiling suggestion when the target cannot be reached', () => {
    const totals: PointsModeTotals = {
      earnedSum: 16,
      totalPossible: 47,
      completedPossibleSum: 23,
      percent: (16 / 47) * 100,
    }
    const result = simulateTargetGrade(totals, 'A') // A = 93%, needs >100% of the rest
    expect(result.kind).toBe('impossible')
    if (result.kind === 'impossible') {
      // max attainable = (16 + 24) / 47 = 85.1% -> B band (83-86)
      expect(result.ceilingLetter).toBe('B')
      expect(result.ceilingPercent).toBeCloseTo(85.1, 1)
    }
  })

  it('reports impossible when nothing is left to earn and the target is missed', () => {
    const totals: PointsModeTotals = { earnedSum: 50, totalPossible: 100, completedPossibleSum: 100, percent: 50 }
    const result = simulateTargetGrade(totals, 'A')
    expect(result.kind).toBe('impossible')
    if (result.kind === 'impossible') {
      expect(result.ceilingLetter).toBe('F')
      expect(result.ceilingPercent).toBe(50)
    }
  })
})
