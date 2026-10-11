import type { CalcCategory, PointsModeTotals } from './types'

interface Scoreable {
  id: string
  status: string
  pointsPossible: number | null
  pointsEarned: number | null
}

export interface DropLowestResult {
  earnedSum: number
  possibleSum: number
  droppedAssessmentIds: string[]
}

/**
 * Mirrors the real spreadsheets' LET() drop-lowest formula: among completed items,
 * sort by score % (not raw points, so unequal-value quizzes are handled correctly —
 * the Fall workbook's formula assumes equal-value quizzes, which this intentionally fixes),
 * drop the N lowest-scoring, and subtract them from both the earned and possible sums.
 */
export function applyDropLowestToCompleted<T extends Scoreable>(assessments: T[], dropCount: number): DropLowestResult {
  const completed = assessments.filter(
    (a): a is T & { pointsPossible: number; pointsEarned: number } =>
      a.status === 'completed' && a.pointsEarned !== null && a.pointsPossible !== null,
  )
  const scored = completed.map((a) => ({
    ...a,
    pct: a.pointsPossible > 0 ? a.pointsEarned / a.pointsPossible : 0,
  }))
  scored.sort((a, b) => a.pct - b.pct)
  const dropCountClamped = Math.max(0, Math.min(dropCount, scored.length))
  const dropped = scored.slice(0, dropCountClamped)
  const kept = scored.slice(dropCountClamped)
  return {
    earnedSum: kept.reduce((sum, a) => sum + a.pointsEarned, 0),
    possibleSum: kept.reduce((sum, a) => sum + a.pointsPossible, 0),
    droppedAssessmentIds: dropped.map((a) => a.id),
  }
}

function pointsPossibleOf(a: { pointsPossible: number | null }): number {
  return a.pointsPossible ?? 0
}

/**
 * Total possible points for a category across ALL assessments (planned/pending/completed),
 * reduced by dropLowestCount * average points-per-item. We don't yet know which future item
 * will end up being one of the N dropped, so this approximates using the category's average
 * item value — exact when items are equal-value (the common real-world case).
 */
export function categoryEffectiveTotalPossible(category: CalcCategory): number {
  const all = category.assessments
  if (all.length === 0) return 0
  const totalPossible = all.reduce((sum, a) => sum + pointsPossibleOf(a), 0)
  if (category.dropLowestCount <= 0) return totalPossible
  const avgPossible = totalPossible / all.length
  const effectiveDrops = Math.min(category.dropLowestCount, all.length)
  return totalPossible - effectiveDrops * avgPossible
}

export function categoryCompletedTotals(category: CalcCategory): DropLowestResult {
  return applyDropLowestToCompleted(category.assessments, category.dropLowestCount)
}

export function pointsModeTotals(categories: CalcCategory[]): PointsModeTotals {
  let earnedSum = 0
  let totalPossible = 0
  let completedPossibleSum = 0
  for (const category of categories) {
    const completed = categoryCompletedTotals(category)
    earnedSum += completed.earnedSum
    completedPossibleSum += completed.possibleSum
    totalPossible += categoryEffectiveTotalPossible(category)
  }
  const percent = totalPossible > 0 ? (earnedSum / totalPossible) * 100 : null
  return { earnedSum, totalPossible, completedPossibleSum, percent }
}
