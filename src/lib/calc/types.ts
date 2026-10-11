export type AssessmentStatus = 'planned' | 'pending' | 'completed'

export interface CalcAssessment {
  id: string
  status: AssessmentStatus
  pointsPossible: number | null
  pointsEarned: number | null
  percentDirect: number | null
}

export interface CalcCategory {
  id: string
  weightPct: number | null
  dropLowestCount: number
  assessments: CalcAssessment[]
}

/** A completed item may be graded either via raw points or a direct percentage — never both. */
export function resolvedPercent(a: CalcAssessment): number | null {
  if (a.percentDirect !== null) return a.percentDirect
  if (a.pointsEarned !== null && a.pointsPossible !== null && a.pointsPossible > 0) {
    return (a.pointsEarned / a.pointsPossible) * 100
  }
  return null
}

export interface PointsModeTotals {
  /** Points guaranteed so far (after drop-lowest), out of totalPossible. */
  earnedSum: number
  /** Effective total points for the whole course, across every assessment, after drop-lowest. */
  totalPossible: number
  /** Portion of totalPossible already "settled" by completed work (after drop-lowest). */
  completedPossibleSum: number
  percent: number | null
}
