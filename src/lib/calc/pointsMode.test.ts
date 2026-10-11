import { describe, expect, it } from 'vitest'

import { applyDropLowestToCompleted, categoryEffectiveTotalPossible, pointsModeTotals } from './pointsMode'
import type { CalcCategory } from './types'

// Fixtures grounded in the real Grade Tracker workbooks (see plan): MA II's
// Exam 1 row (16/23), and an OPP III-style drop-lowest-quizzes category.

describe('applyDropLowestToCompleted', () => {
  it('sorts by score percentage, not raw points, so unequal-value quizzes drop correctly', () => {
    const quizzes = [
      { id: 'q1', status: 'completed', pointsPossible: 2, pointsEarned: 1 }, // 50%
      { id: 'q2', status: 'completed', pointsPossible: 10, pointsEarned: 8 }, // 80%
      { id: 'q3', status: 'completed', pointsPossible: 5, pointsEarned: 4 }, // 80%
    ]
    const result = applyDropLowestToCompleted(quizzes, 1)
    expect(result.droppedAssessmentIds).toEqual(['q1'])
    expect(result.earnedSum).toBe(12) // q2 + q3
    expect(result.possibleSum).toBe(15)
  })

  it('ignores planned/pending items and clamps drop count to the number completed', () => {
    const items = [
      { id: 'a', status: 'completed', pointsPossible: 10, pointsEarned: 5 },
      { id: 'b', status: 'planned', pointsPossible: 10, pointsEarned: null },
    ]
    const result = applyDropLowestToCompleted(items, 5)
    expect(result.earnedSum).toBe(0)
    expect(result.possibleSum).toBe(0)
    expect(result.droppedAssessmentIds).toEqual(['a'])
  })
})

describe('categoryEffectiveTotalPossible', () => {
  it('reduces total possible by dropCount * average item value', () => {
    const category: CalcCategory = {
      id: 'cat',
      weightPct: null,
      dropLowestCount: 1,
      assessments: [
        { id: '1', status: 'completed', pointsPossible: 10, pointsEarned: 8, percentDirect: null },
        { id: '2', status: 'completed', pointsPossible: 10, pointsEarned: 6, percentDirect: null },
        { id: '3', status: 'planned', pointsPossible: 10, pointsEarned: null, percentDirect: null },
      ],
    }
    expect(categoryEffectiveTotalPossible(category)).toBe(20)
  })
})

describe('pointsModeTotals', () => {
  it('matches the point-accumulation formula from the real sheets', () => {
    const categories: CalcCategory[] = [
      {
        id: 'exam',
        weightPct: null,
        dropLowestCount: 0,
        assessments: [
          { id: 'exam1', status: 'completed', pointsPossible: 23, pointsEarned: 16, percentDirect: null },
          { id: 'exam2', status: 'planned', pointsPossible: 24, pointsEarned: null, percentDirect: null },
        ],
      },
    ]
    const totals = pointsModeTotals(categories)
    expect(totals.earnedSum).toBe(16)
    expect(totals.completedPossibleSum).toBe(23)
    expect(totals.totalPossible).toBe(47)
    expect(totals.percent).toBeCloseTo((16 / 47) * 100, 5)
  })

  it('applies drop-lowest per category before summing across categories', () => {
    const categories: CalcCategory[] = [
      {
        id: 'quizzes',
        weightPct: null,
        dropLowestCount: 1,
        assessments: [
          { id: 'q1', status: 'completed', pointsPossible: 2, pointsEarned: 1, percentDirect: null }, // 50%, dropped
          { id: 'q2', status: 'completed', pointsPossible: 2, pointsEarned: 1.5, percentDirect: null }, // 75%
          { id: 'q3', status: 'pending', pointsPossible: 2, pointsEarned: null, percentDirect: null },
        ],
      },
      {
        id: 'practicals',
        weightPct: null,
        dropLowestCount: 0,
        assessments: [{ id: 'p1', status: 'completed', pointsPossible: 15, pointsEarned: 8, percentDirect: null }],
      },
    ]
    const totals = pointsModeTotals(categories)
    // quizzes: effective total = (2+2+2) - 1*2 = 4; earned/possible after drop = 1.5/2
    // practicals: 8/15
    expect(totals.earnedSum).toBe(1.5 + 8)
    expect(totals.completedPossibleSum).toBe(2 + 15)
    expect(totals.totalPossible).toBe(4 + 15)
  })
})
