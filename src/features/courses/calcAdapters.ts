import { categoryModeTotals } from '../../lib/calc/categoryMode'
import { pointsModeTotals } from '../../lib/calc/pointsMode'
import type { PointsModeTotals, CalcAssessment, CalcCategory } from '../../lib/calc/types'
import { pctToBand, type GradeBand } from '../../lib/calc/gradeScale'
import { supabase } from '../../lib/supabase/client'
import type { Assessment, CalcMode, Category } from '../../lib/supabase/types'

/**
 * Maps a DB assessment row to the calc engine's shape. `pointsPossible` prefers the actual
 * (finalized) points over the syllabus estimate, since the actual value is what the item was
 * really worth once graded — the syllabus figure is just a planning-time guess.
 *
 * A points-mode course's totals only look at `pointsEarned`/`pointsPossible` (see
 * `src/lib/calc/pointsMode.ts`), so an item graded via `percentDirect` alone would otherwise
 * silently not count toward that course's grade. We derive an equivalent `pointsEarned` here
 * (percent * pointsPossible) so it counts either way — category-mode courses are unaffected
 * since `resolvedPercent` there prefers `percentDirect` when present.
 *
 * `comment` is intentionally NOT read here: it must never influence any calculation.
 */
export function toCalcAssessment(a: Assessment): CalcAssessment {
  const pointsPossible = a.points_possible_actual ?? a.points_possible_syllabus
  const derivedFromPercent =
    a.percent_direct !== null && pointsPossible !== null && pointsPossible > 0
      ? (a.percent_direct / 100) * pointsPossible
      : null
  return {
    id: a.id,
    status: a.status,
    pointsPossible,
    pointsEarned: a.points_earned ?? derivedFromPercent,
    percentDirect: a.percent_direct,
  }
}

export function toCalcCategories(categories: Category[], assessments: Assessment[]): CalcCategory[] {
  return categories.map((cat) => ({
    id: cat.id,
    weightPct: cat.weight_pct,
    dropLowestCount: cat.drop_lowest_count,
    assessments: assessments.filter((a) => a.category_id === cat.id).map(toCalcAssessment),
  }))
}

export function totalsForCourse(calcMode: CalcMode, categories: CalcCategory[]): PointsModeTotals {
  return calcMode === 'points' ? pointsModeTotals(categories) : categoryModeTotals(categories)
}

export interface CourseGrade {
  percent: number | null
  letter: string | null
}

export function courseGrade(calcMode: CalcMode, categories: CalcCategory[], scale: GradeBand[]): CourseGrade {
  const totals = totalsForCourse(calcMode, categories)
  if (totals.percent === null) return { percent: null, letter: null }
  return { percent: totals.percent, letter: pctToBand(totals.percent, scale).letter }
}

export const courseCalcQueryKey = (courseId: string) => ['course-calc', courseId] as const

/** Fetches a course's categories + their assessments and maps them straight to calc shapes. */
export async function fetchCourseCalcCategories(courseId: string): Promise<CalcCategory[]> {
  const { data: categories, error } = await supabase.from('categories').select('*').eq('course_id', courseId)
  if (error) throw error
  const categoryIds = categories.map((c) => c.id)
  if (categoryIds.length === 0) return []
  const { data: assessments, error: assessmentsError } = await supabase
    .from('assessments')
    .select('*')
    .in('category_id', categoryIds)
  if (assessmentsError) throw assessmentsError
  return toCalcCategories(categories, assessments)
}
