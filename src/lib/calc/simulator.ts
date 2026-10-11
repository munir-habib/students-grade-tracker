import { pointsModeTotals } from './pointsMode'
import { categoryModeTotals } from './categoryMode'
import { DEFAULT_GRADE_SCALE, minPctForLetter, pctToBand, type GradeBand } from './gradeScale'
import type { CalcCategory, PointsModeTotals } from './types'

export type SimResult =
  | { kind: 'guaranteed'; letter: string }
  | { kind: 'achievable'; letter: string; neededPercentOnRest: number }
  | { kind: 'impossible'; letter: string; ceilingLetter: string; ceilingPercent: number }

/**
 * Spec §6's three-branch formula: already-guaranteed / achievable-% / impossible-with-ceiling.
 * Works for both calc modes since both produce a PointsModeTotals-shaped result.
 */
export function simulateTargetGrade(
  totals: PointsModeTotals,
  targetLetter: string,
  scale: GradeBand[] = DEFAULT_GRADE_SCALE,
): SimResult {
  const targetMinPct = minPctForLetter(targetLetter, scale)
  if (targetMinPct === null) throw new Error(`Unknown letter grade: ${targetLetter}`)

  const remainingPossible = totals.totalPossible - totals.completedPossibleSum
  const neededPointsTotal = (targetMinPct / 100) * totals.totalPossible
  const neededPoints = neededPointsTotal - totals.earnedSum

  if (neededPoints <= 0) {
    return { kind: 'guaranteed', letter: targetLetter }
  }
  if (remainingPossible <= 0) {
    const ceiling = pctToBand(totals.percent ?? 0, scale)
    return { kind: 'impossible', letter: targetLetter, ceilingLetter: ceiling.letter, ceilingPercent: totals.percent ?? 0 }
  }

  const neededPercentOnRest = (neededPoints / remainingPossible) * 100
  if (neededPercentOnRest <= 100) {
    return { kind: 'achievable', letter: targetLetter, neededPercentOnRest }
  }

  const maxAttainablePoints = totals.earnedSum + remainingPossible
  const maxAttainablePercent = totals.totalPossible > 0 ? (maxAttainablePoints / totals.totalPossible) * 100 : 0
  const ceiling = pctToBand(maxAttainablePercent, scale)
  return { kind: 'impossible', letter: targetLetter, ceilingLetter: ceiling.letter, ceilingPercent: maxAttainablePercent }
}

export function simulateTargetGradeForCourse(
  categories: CalcCategory[],
  calcMode: 'points' | 'category_percentage',
  targetLetter: string,
  scale: GradeBand[] = DEFAULT_GRADE_SCALE,
): SimResult {
  const totals = calcMode === 'points' ? pointsModeTotals(categories) : categoryModeTotals(categories)
  return simulateTargetGrade(totals, targetLetter, scale)
}

export interface HypotheticalScore {
  assessmentId: string
  pointsEarned: number
  pointsPossible: number
}

/**
 * "Play it my way" scenario: treats each hypothetical as if that assessment were
 * completed with the given score, then recomputes the course total live.
 */
export function simulatePerAssessmentScenario(
  categories: CalcCategory[],
  calcMode: 'points' | 'category_percentage',
  hypotheticals: HypotheticalScore[],
): PointsModeTotals {
  const hypById = new Map(hypotheticals.map((h) => [h.assessmentId, h]))
  const merged = categories.map((category) => ({
    ...category,
    assessments: category.assessments.map((a) => {
      const hyp = hypById.get(a.id)
      if (!hyp) return a
      return {
        ...a,
        status: 'completed' as const,
        pointsEarned: hyp.pointsEarned,
        pointsPossible: hyp.pointsPossible,
        percentDirect: null,
      }
    }),
  }))
  return calcMode === 'points' ? pointsModeTotals(merged) : categoryModeTotals(merged)
}
