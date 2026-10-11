import { applyDropLowestToCompleted } from './pointsMode'
import type { CalcCategory, PointsModeTotals } from './types'
import { resolvedPercent } from './types'

interface CategoryUnitStats {
  /** Sum of (kept completed items' pct / 100), i.e. a fractional "earned count". */
  earnedFraction: number
  /** Count of completed items kept after drop-lowest. */
  keptCompletedCount: number
  /** Total item count in the category after drop-lowest. */
  effectiveTotalCount: number
}

/**
 * Normalizes a category's items to "1 point possible" each so the same drop-lowest
 * logic used in points mode can compute a simple (optionally drop-adjusted) average
 * of item percentages — matching the spec's "média da categoria" wording.
 */
function categoryUnitStats(category: CalcCategory): CategoryUnitStats {
  const unitAssessments = category.assessments.map((a) => ({
    id: a.id,
    status: a.status,
    pointsPossible: 1,
    pointsEarned: a.status === 'completed' ? (resolvedPercent(a) ?? 0) / 100 : null,
  }))
  const completedCount = unitAssessments.filter((a) => a.status === 'completed').length
  const dropCount = Math.min(category.dropLowestCount, completedCount)
  const drop = applyDropLowestToCompleted(unitAssessments, category.dropLowestCount)
  return {
    earnedFraction: drop.earnedSum,
    keptCompletedCount: completedCount - dropCount,
    effectiveTotalCount: unitAssessments.length - dropCount,
  }
}

/** Current average % for one category (completed items only, after drop-lowest), or null if nothing graded yet. */
export function categoryAveragePercent(category: CalcCategory): number | null {
  const stats = categoryUnitStats(category)
  if (stats.keptCompletedCount === 0) return null
  return (stats.earnedFraction / stats.keptCompletedCount) * 100
}

/**
 * Weighted percentage-by-category mode, expressed through the same shape as points mode
 * (earnedSum / totalPossible / completedPossibleSum, out of a virtual 100 "total weight")
 * so `simulateTargetGrade` works unchanged for both calc modes.
 */
export function categoryModeTotals(categories: CalcCategory[]): PointsModeTotals {
  let earnedSum = 0
  let totalPossible = 0
  let completedPossibleSum = 0
  for (const category of categories) {
    const weight = category.weightPct ?? 0
    totalPossible += weight
    if (category.assessments.length === 0) continue
    const stats = categoryUnitStats(category)
    if (stats.effectiveTotalCount === 0) continue
    const currentAvgFraction = stats.earnedFraction / stats.effectiveTotalCount
    const settledFraction = stats.keptCompletedCount / stats.effectiveTotalCount
    earnedSum += weight * currentAvgFraction
    completedPossibleSum += weight * settledFraction
  }
  const percent = totalPossible > 0 ? (earnedSum / totalPossible) * 100 : null
  return { earnedSum, totalPossible, completedPossibleSum, percent }
}
