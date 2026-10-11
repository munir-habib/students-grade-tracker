import { DEFAULT_GRADE_SCALE, pctToBand, type GradeBand } from './gradeScale'

export interface CourseGpaInput {
  id: string
  credits: number
  currentPercent: number | null
  retakeOfCourseId: string | null
  /** Higher = more recent term; used to pick the latest attempt in a retake chain. */
  termOrder: number
}

export function courseGpaPoints(percent: number | null, scale: GradeBand[] = DEFAULT_GRADE_SCALE): number | null {
  if (percent === null) return null
  return pctToBand(percent, scale).gpaPoints
}

function retakeChainRootId(course: CourseGpaInput, byId: Map<string, CourseGpaInput>): string {
  let current = course
  const seen = new Set<string>()
  while (current.retakeOfCourseId && byId.has(current.retakeOfCourseId) && !seen.has(current.id)) {
    seen.add(current.id)
    current = byId.get(current.retakeOfCourseId)!
  }
  return current.id
}

/**
 * Credit-weighted GPA across courses/terms. When onlyLastAttempt is true (spec §4 default),
 * a course and every course that retakes it (chained via retakeOfCourseId) collapse to just
 * the most recent attempt before averaging.
 */
export function overallGpa(
  courses: CourseGpaInput[],
  options: { onlyLastAttempt: boolean },
  scale: GradeBand[] = DEFAULT_GRADE_SCALE,
): number | null {
  let effectiveCourses = courses
  if (options.onlyLastAttempt) {
    const byId = new Map(courses.map((c) => [c.id, c]))
    const chains = new Map<string, CourseGpaInput[]>()
    for (const course of courses) {
      const root = retakeChainRootId(course, byId)
      const chain = chains.get(root) ?? []
      chain.push(course)
      chains.set(root, chain)
    }
    effectiveCourses = [...chains.values()].map((chain) =>
      chain.reduce((latest, c) => (c.termOrder > latest.termOrder ? c : latest)),
    )
  }

  const graded = effectiveCourses.filter((c) => c.currentPercent !== null && c.credits > 0)
  const totalCredits = graded.reduce((sum, c) => sum + c.credits, 0)
  if (totalCredits === 0) return null

  const totalPoints = graded.reduce((sum, c) => sum + (courseGpaPoints(c.currentPercent, scale) ?? 0) * c.credits, 0)
  return totalPoints / totalCredits
}
