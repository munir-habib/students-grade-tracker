import { describe, expect, it } from 'vitest'

import { overallGpa } from './gpa'
import type { CourseGpaInput } from './gpa'

describe('overallGpa', () => {
  const failedAttempt: CourseGpaInput = {
    id: 'course-a-v1',
    credits: 4,
    currentPercent: 60, // F
    retakeOfCourseId: null,
    termOrder: 1,
  }
  const retakeAttempt: CourseGpaInput = {
    id: 'course-a-v2',
    credits: 4,
    currentPercent: 85, // B
    retakeOfCourseId: 'course-a-v1',
    termOrder: 2,
  }
  const unrelatedCourse: CourseGpaInput = {
    id: 'course-c',
    credits: 3,
    currentPercent: 90, // A-
    retakeOfCourseId: null,
    termOrder: 1,
  }

  it('counts only the latest attempt per retake chain by default', () => {
    const gpa = overallGpa([failedAttempt, retakeAttempt, unrelatedCourse], { onlyLastAttempt: true })
    // (3.0*4 + 3.7*3) / 7 = 3.3
    expect(gpa).toBeCloseTo(3.3, 5)
  })

  it('counts both attempts when onlyLastAttempt is false', () => {
    const gpa = overallGpa([failedAttempt, retakeAttempt, unrelatedCourse], { onlyLastAttempt: false })
    // (0*4 + 3.0*4 + 3.7*3) / 11 = 2.1
    expect(gpa).toBeCloseTo(2.1, 5)
  })

  it('ignores ungraded courses and returns null when nothing is graded', () => {
    const ungraded: CourseGpaInput = { id: 'x', credits: 3, currentPercent: null, retakeOfCourseId: null, termOrder: 1 }
    expect(overallGpa([ungraded], { onlyLastAttempt: true })).toBeNull()
  })
})
