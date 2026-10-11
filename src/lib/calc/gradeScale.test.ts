import { describe, expect, it } from 'vitest'

import { DEFAULT_GRADE_SCALE, letterShortcuts, minPctForLetter, pctToBand } from './gradeScale'

describe('pctToBand', () => {
  it.each([
    [95, 'A'],
    [93, 'A'],
    [92, 'A-'],
    [90, 'A-'],
    [86, 'B'],
    [83, 'B'],
    [82, 'B-'],
    [70, 'C-'],
    [69.9, 'F'],
    [0, 'F'],
  ])('maps %d%% to %s', (pct, expectedLetter) => {
    expect(pctToBand(pct).letter).toBe(expectedLetter)
  })
})

describe('minPctForLetter', () => {
  it('round-trips with the default scale', () => {
    expect(minPctForLetter('B')).toBe(83)
    expect(minPctForLetter('Z')).toBeNull()
  })
})

describe('letterShortcuts', () => {
  it('excludes F and orders best-to-worst', () => {
    const shortcuts = letterShortcuts()
    expect(shortcuts).not.toContain('F')
    expect(shortcuts[0]).toBe('A')
    expect(shortcuts).toHaveLength(DEFAULT_GRADE_SCALE.length - 1)
  })
})
