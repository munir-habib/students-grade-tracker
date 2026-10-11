import { useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'

import { toCalcCategories, courseGrade } from './calcAdapters'
import { CategoryManager } from './CategoryManager'
import { categoriesQueryKey, useCategories } from './categoriesApi'
import { useCourse } from './coursesApi'
import { useCourseGradeScale } from './gradeScaleApi'
import { Board } from '../board/Board'
import { assessmentsQueryKey, useAssessments } from '../assessments/assessmentsApi'
import { SimulatorPanel } from '../simulator/SimulatorPanel'
import { SyllabusImportButton } from '../syllabus-import/SyllabusImportModal'
import { useTerm } from '../terms/termsApi'

function calcModeLabel(t: (key: string) => string, mode: 'points' | 'category_percentage') {
  return mode === 'points' ? t('courses.calcModePoints') : t('courses.calcModeCategoryPercentage')
}

function statusLabel(t: (key: string) => string, status: 'in_progress' | 'completed' | 'failed_retaking') {
  if (status === 'in_progress') return t('courses.statusInProgress')
  if (status === 'completed') return t('courses.statusCompleted')
  return t('courses.statusFailedRetaking')
}

export function CourseDetailPage() {
  const { t } = useTranslation()
  const { courseId } = useParams()
  const queryClient = useQueryClient()

  const courseQuery = useCourse(courseId)
  const course = courseQuery.data
  const termQuery = useTerm(course?.term_id)

  const categoriesQuery = useCategories(courseId)
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data])
  const categoryIds = useMemo(() => categories.map((c) => c.id), [categories])

  const assessmentsQuery = useAssessments(courseId, categoryIds)
  const assessments = useMemo(() => assessmentsQuery.data ?? [], [assessmentsQuery.data])

  const { scale } = useCourseGradeScale(course?.grade_scale_id)

  const calcCategories = useMemo(() => toCalcCategories(categories, assessments), [categories, assessments])
  const pendingOrPlanned = useMemo(
    () => assessments.filter((a) => a.status === 'planned' || a.status === 'pending'),
    [assessments],
  )

  if (courseQuery.isLoading) {
    return <p className="text-sm text-[var(--color-text-muted)]">{t('common.loading')}</p>
  }
  if (courseQuery.isError || !course) {
    return <p className="text-sm text-[var(--color-danger)]">{t('common.loadError')}</p>
  }

  const grade = courseGrade(course.calc_mode, calcCategories, scale)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/courses" className="text-xs text-[var(--color-accent)] hover:underline">
          ← {t('courses.title')}
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold">{course.name}</h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-muted)]">
              {termQuery.data && <span>{termQuery.data.name}</span>}
              <span>·</span>
              <span>{course.credits} {t('courses.credits').toLowerCase()}</span>
              <span>·</span>
              <span>{calcModeLabel(t, course.calc_mode)}</span>
              <span>·</span>
              <span>{statusLabel(t, course.status)}</span>
            </div>
          </div>
          <span className="text-xl font-semibold">
            {grade.percent !== null ? `${grade.percent.toFixed(1)}% (${grade.letter})` : '—'}
          </span>
        </div>
      </div>

      <CategoryManager courseId={course.id} calcMode={course.calc_mode} categories={categories} />

      <div>
        <SyllabusImportButton
          courseId={course.id}
          onImported={() => {
            void queryClient.invalidateQueries({ queryKey: categoriesQueryKey(course.id) })
            void queryClient.invalidateQueries({ queryKey: assessmentsQueryKey(course.id) })
          }}
        />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">{t('board.addAssessment')}</h2>
        {categories.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">{t('common.empty')}</p>
        ) : (
          <Board courseId={course.id} categories={categories} assessments={assessments} />
        )}
      </section>

      <SimulatorPanel
        calcMode={course.calc_mode}
        categories={calcCategories}
        pendingOrPlanned={pendingOrPlanned}
        scale={scale}
      />
    </div>
  )
}
