import { describe, expect, it } from 'vitest'

import { categoryAveragePercent, categoryModeTotals } from './categoryMode'
import type { CalcCategory } from './types'

describe('categoryAveragePercent', () => {
  it('averages completed items only, after drop-lowest, ignoring pending ones', () => {
    const quizzes: CalcCategory = {
      id: 'quizzes',
      weightPct: 20,
      dropLowestCount: 1,
      assessments: [
        { id: 'q1', status: 'completed', pointsPossible: null, pointsEarned: null, percentDirect: 90 },
        { id: 'q2', status: 'completed', pointsPossible: null, pointsEarned: null, percentDirect: 60 },
        { id: 'q3', status: 'planned', pointsPossible: null, pointsEarned: null, percentDirect: null },
      ],
    }
    expect(categoryAveragePercent(quizzes)).toBeCloseTo(90, 5)
  })

  it('returns null when nothing is graded yet', () => {
    const category: CalcCategory = {
      id: 'exams',
      weightPct: 80,
      dropLowestCount: 0,
      assessments: [{ id: 'e1', status: 'planned', pointsPossible: 40, pointsEarned: null, percentDirect: null }],
    }
    expect(categoryAveragePercent(category)).toBeNull()
  })
})

describe('categoryModeTotals', () => {
  it('weights each category by weightPct and tracks how much weight is already settled', () => {
    const categories: CalcCategory[] = [
      {
        id: 'quizzes',
        weightPct: 20,
        dropLowestCount: 1,
        assessments: [
          { id: 'q1', status: 'completed', pointsPossible: null, pointsEarned: null, percentDirect: 90 },
          { id: 'q2', status: 'completed', pointsPossible: null, pointsEarned: null, percentDirect: 60 },
          { id: 'q3', status: 'planned', pointsPossible: null, pointsEarned: null, percentDirect: null },
        ],
      },
      {
        id: 'exams',
        weightPct: 80,
        dropLowestCount: 0,
        assessments: [{ id: 'e1', status: 'completed', pointsPossible: null, pointsEarned: null, percentDirect: 85 }],
      },
    ]
    const totals = categoryModeTotals(categories)
    // quizzes: earnedFraction 0.9 over effectiveTotalCount 2 -> 0.45 * weight 20 = 9; settled 1/2 * 20 = 10
    // exams: 0.85 * 80 = 68; settled 1/1 * 80 = 80
    expect(totals.earnedSum).toBeCloseTo(9 + 68, 5)
    expect(totals.completedPossibleSum).toBeCloseTo(10 + 80, 5)
    expect(totals.totalPossible).toBe(100)
    expect(totals.percent).toBeCloseTo(77, 5)
  })
})
