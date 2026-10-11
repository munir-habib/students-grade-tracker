import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../auth/AuthContext'
import { overallGpa, type CourseGpaInput } from '../../lib/calc/gpa'
import { supabase } from '../../lib/supabase/client'
import type { Assessment, Category, Course, Term } from '../../lib/supabase/types'
import { courseGrade, toCalcCategories } from '../courses/calcAdapters'
import { useGradeScalesForCourses } from '../courses/gradeScaleApi'

interface DashboardData {
  terms: Term[]
  courses: Course[]
  categories: Category[]
  assessments: Assessment[]
}

const ALL_TERMS = 'all'

export function DashboardPage() {
  const { t, i18n } = useTranslation()
  const { session, profile } = useAuth()
  const userId = session?.user.id
  const [selectedTermId, setSelectedTermId] = useState<string>(ALL_TERMS)

  const { data, isPending, isError } = useQuery({
    queryKey: ['dashboard', userId],
    enabled: !!userId,
    queryFn: async (): Promise<DashboardData> => {
      const [termsRes, coursesRes, categoriesRes, assessmentsRes] = await Promise.all([
        supabase.from('terms').select('*').eq('user_id', userId!).order('sort_order'),
        supabase.from('courses').select('*').eq('user_id', userId!),
        // RLS scopes these to the current user's courses automatically — no direct user_id column.
        supabase.from('categories').select('*'),
        supabase.from('assessments').select('*'),
      ])
      if (termsRes.error) throw termsRes.error
      if (coursesRes.error) throw coursesRes.error
      if (categoriesRes.error) throw categoriesRes.error
      if (assessmentsRes.error) throw assessmentsRes.error
      return {
        terms: termsRes.data ?? [],
        courses: coursesRes.data ?? [],
        categories: categoriesRes.data ?? [],
        assessments: assessmentsRes.data ?? [],
      }
    },
  })

  const onlyLastAttempt = profile?.only_last_attempt_counts ?? true
  const { scaleFor } = useGradeScalesForCourses(data?.courses)

  const courseRows = useMemo(() => {
    if (!data) return []
    const termOrderById = new Map(data.terms.map((term) => [term.id, term.sort_order]))
    return data.courses.map((course) => {
      const courseCategories = data.categories.filter((c) => c.course_id === course.id)
      const calcCategories = toCalcCategories(courseCategories, data.assessments)
      const grade = courseGrade(course.calc_mode, calcCategories, scaleFor(course))
      return {
        course,
        currentPercent: grade.percent,
        letter: grade.letter,
        termOrder: termOrderById.get(course.term_id) ?? 0,
      }
    })
  }, [data, scaleFor])

  const visibleRows = useMemo(
    () =>
      selectedTermId === ALL_TERMS ? courseRows : courseRows.filter((row) => row.course.term_id === selectedTermId),
    [courseRows, selectedTermId],
  )

  const gpa = useMemo(() => {
    const inputs: CourseGpaInput[] = visibleRows.map((row) => ({
      id: row.course.id,
      credits: row.course.credits,
      currentPercent: row.currentPercent,
      retakeOfCourseId: row.course.retake_of_course_id,
      termOrder: row.termOrder,
    }))
    return overallGpa(inputs, { onlyLastAttempt })
  }, [visibleRows, onlyLastAttempt])

  const formatPercent = (percent: number | null) => (percent === null ? '—' : `${percent.toFixed(1)}%`)

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold">{t('dashboard.title')}</h1>

      {isPending && <p className="text-sm text-[var(--color-text-muted)]">{t('common.loading')}</p>}
      {isError && <p className="text-sm text-[var(--color-danger)]">{t('common.loadError')}</p>}

      {!isPending && !isError && data && (
        <>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs text-[var(--color-text-muted)] uppercase">{t('dashboard.overallGpa')}</p>
                <p className="text-3xl font-bold text-[var(--color-accent)]">{gpa === null ? '—' : gpa.toFixed(2)}</p>
              </div>
              <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
                {t('dashboard.filterByTerm')}
                <select
                  value={selectedTermId}
                  onChange={(e) => setSelectedTermId(e.target.value)}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-sm text-[var(--color-text)]"
                >
                  <option value={ALL_TERMS}>{t('terms.allTerms')}</option>
                  {data.terms.map((term) => (
                    <option key={term.id} value={term.id}>
                      {term.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {visibleRows.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">{t('dashboard.noCourses')}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead className="bg-[var(--color-surface)] text-[var(--color-text-muted)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t('courses.courseName')}</th>
                    <th className="px-3 py-2 font-medium">{t('courses.credits')}</th>
                    <th className="px-3 py-2 font-medium">{t('dashboard.grade')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map(({ course, currentPercent, letter }) => (
                    <tr key={course.id} className="border-t border-[var(--color-border)]">
                      <td className="px-3 py-2">{course.name}</td>
                      <td className="px-3 py-2">
                        {new Intl.NumberFormat(i18n.language).format(course.credits)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatPercent(currentPercent)}
                        {letter ? ` (${letter})` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
