import { useQueries } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { useAuth } from '../auth/AuthContext'
import { courseCalcQueryKey, courseGrade, fetchCourseCalcCategories } from './calcAdapters'
import { type CreateCourseInput, useCourses, useCreateCourse, useUpdateCourse } from './coursesApi'
import { useGradeScalesForCourses } from './gradeScaleApi'
import { Modal } from './Modal'
import { nextTermSortOrder, useCreateTerm, useTerms } from '../terms/termsApi'
import type { CalcCategory } from '../../lib/calc/types'
import type { GradeBand } from '../../lib/calc/gradeScale'
import type { CalcMode, Course, CourseStatus, Term } from '../../lib/supabase/types'

const CALC_MODES: CalcMode[] = ['points', 'category_percentage']
const COURSE_STATUSES: CourseStatus[] = ['in_progress', 'completed', 'failed_retaking']

function calcModeLabel(t: (key: string) => string, mode: CalcMode) {
  return mode === 'points' ? t('courses.calcModePoints') : t('courses.calcModeCategoryPercentage')
}

function statusLabel(t: (key: string) => string, status: CourseStatus) {
  if (status === 'in_progress') return t('courses.statusInProgress')
  if (status === 'completed') return t('courses.statusCompleted')
  return t('courses.statusFailedRetaking')
}

export function CoursesPage() {
  const { t } = useTranslation()
  const { session } = useAuth()
  const userId = session?.user.id

  const termsQuery = useTerms(userId)
  const coursesQuery = useCourses(userId)
  const createTerm = useCreateTerm()
  const createCourse = useCreateCourse()
  const updateCourse = useUpdateCourse(userId)

  const { scaleFor } = useGradeScalesForCourses(coursesQuery.data)

  const calcQueries = useQueries({
    queries: (coursesQuery.data ?? []).map((c) => ({
      queryKey: courseCalcQueryKey(c.id),
      queryFn: () => fetchCourseCalcCategories(c.id),
    })),
  })
  const calcByCourseId = new Map<string, CalcCategory[]>()
  ;(coursesQuery.data ?? []).forEach((c, i) => {
    const data = calcQueries[i]?.data
    if (data) calcByCourseId.set(c.id, data)
  })

  const [showAddTerm, setShowAddTerm] = useState(false)
  const [newTermName, setNewTermName] = useState('')
  const [newTermStart, setNewTermStart] = useState('')
  const [newTermEnd, setNewTermEnd] = useState('')

  const [addCourseTermId, setAddCourseTermId] = useState<string | null>(null)
  const [retakeCourse, setRetakeCourse] = useState<Course | null>(null)

  const handleCreateTerm = async () => {
    if (!userId || !newTermName.trim()) return
    await createTerm.mutateAsync({
      userId,
      name: newTermName.trim(),
      startsOn: newTermStart || null,
      endsOn: newTermEnd || null,
      sortOrder: nextTermSortOrder(termsQuery.data),
    })
    setNewTermName('')
    setNewTermStart('')
    setNewTermEnd('')
    setShowAddTerm(false)
  }

  const terms = termsQuery.data ?? []
  const courses = coursesQuery.data ?? []
  const coursesByTerm = new Map<string, Course[]>()
  const courseNameById = new Map<string, string>()
  for (const course of courses) {
    const list = coursesByTerm.get(course.term_id) ?? []
    list.push(course)
    coursesByTerm.set(course.term_id, list)
    courseNameById.set(course.id, course.name)
  }

  const isLoading = termsQuery.isLoading || coursesQuery.isLoading
  const isError = termsQuery.isError || coursesQuery.isError

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{t('courses.title')}</h1>
        <button
          type="button"
          onClick={() => setShowAddTerm((v) => !v)}
          className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm text-[var(--color-accent-contrast)]"
        >
          {t('terms.addTerm')}
        </button>
      </div>

      {showAddTerm && (
        <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--color-text-muted)]">{t('terms.termName')}</label>
            <input
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
              value={newTermName}
              onChange={(e) => setNewTermName(e.target.value)}
              placeholder={t('terms.termName')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--color-text-muted)]">{t('terms.startDate')}</label>
              <input
                type="date"
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
                value={newTermStart}
                onChange={(e) => setNewTermStart(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--color-text-muted)]">{t('terms.endDate')}</label>
              <input
                type="date"
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
                value={newTermEnd}
                onChange={(e) => setNewTermEnd(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddTerm(false)}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              disabled={!newTermName.trim() || createTerm.isPending}
              onClick={() => void handleCreateTerm()}
              className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm text-[var(--color-accent-contrast)] disabled:opacity-50"
            >
              {t('common.add')}
            </button>
          </div>
        </div>
      )}

      {isLoading && <p className="text-sm text-[var(--color-text-muted)]">{t('common.loading')}</p>}
      {isError && <p className="text-sm text-[var(--color-danger)]">{t('common.loadError')}</p>}
      {!isLoading && !isError && terms.length === 0 && (
        <p className="text-sm text-[var(--color-text-muted)]">{t('common.empty')}</p>
      )}

      <div className="flex flex-col gap-6">
        {terms.map((term) => (
          <TermSection
            key={term.id}
            term={term}
            courses={coursesByTerm.get(term.id) ?? []}
            calcByCourseId={calcByCourseId}
            scaleFor={scaleFor}
            courseNameById={courseNameById}
            isAddingCourse={addCourseTermId === term.id}
            onToggleAddCourse={() => setAddCourseTermId((cur) => (cur === term.id ? null : term.id))}
            onCreateCourse={async (input) => {
              await createCourse.mutateAsync(input)
              setAddCourseTermId(null)
            }}
            onMarkFailed={(course) =>
              void updateCourse.mutateAsync({ id: course.id, patch: { status: 'failed_retaking' } })
            }
            onCreateRetake={(course) => setRetakeCourse(course)}
            userId={userId}
          />
        ))}
      </div>

      {retakeCourse && (
        <RetakeModal
          course={retakeCourse}
          terms={terms}
          userId={userId}
          onClose={() => setRetakeCourse(null)}
          onCreate={async (input) => {
            await createCourse.mutateAsync(input)
            setRetakeCourse(null)
          }}
        />
      )}
    </div>
  )
}

interface TermSectionProps {
  term: Term
  courses: Course[]
  calcByCourseId: Map<string, CalcCategory[]>
  scaleFor: (course: { grade_scale_id: string | null }) => GradeBand[]
  courseNameById: Map<string, string>
  isAddingCourse: boolean
  onToggleAddCourse: () => void
  onCreateCourse: (input: CreateCourseInput) => Promise<void>
  onMarkFailed: (course: Course) => void
  onCreateRetake: (course: Course) => void
  userId: string | undefined
}

function TermSection({
  term,
  courses,
  calcByCourseId,
  scaleFor,
  courseNameById,
  isAddingCourse,
  onToggleAddCourse,
  onCreateCourse,
  onMarkFailed,
  onCreateRetake,
  userId,
}: TermSectionProps) {
  const { t } = useTranslation()

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">{term.name}</h2>
          {(term.starts_on || term.ends_on) && (
            <p className="text-xs text-[var(--color-text-muted)]">
              {term.starts_on ?? '—'} – {term.ends_on ?? '—'}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onToggleAddCourse}
          className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm"
        >
          {t('courses.addCourse')}
        </button>
      </div>

      {isAddingCourse && userId && (
        <AddCourseForm
          termId={term.id}
          userId={userId}
          onCreate={onCreateCourse}
          onCancel={onToggleAddCourse}
        />
      )}

      {courses.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">{t('common.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {courses.map((course) => (
            <CourseRow
              key={course.id}
              course={course}
              categories={calcByCourseId.get(course.id) ?? []}
              scale={scaleFor(course)}
              retakeOfName={course.retake_of_course_id ? courseNameById.get(course.retake_of_course_id) : undefined}
              onMarkFailed={() => onMarkFailed(course)}
              onCreateRetake={() => onCreateRetake(course)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

interface CourseRowProps {
  course: Course
  categories: CalcCategory[]
  scale: GradeBand[]
  retakeOfName: string | undefined
  onMarkFailed: () => void
  onCreateRetake: () => void
}

function CourseRow({ course, categories, scale, retakeOfName, onMarkFailed, onCreateRetake }: CourseRowProps) {
  const { t } = useTranslation()
  const grade = courseGrade(course.calc_mode, categories, scale)

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <Link to={`/courses/${course.id}`} className="text-sm font-medium text-[var(--color-accent)] hover:underline">
          {course.name}
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <span>{course.credits} {t('courses.credits').toLowerCase()}</span>
          <span>·</span>
          <span>{calcModeLabel(t, course.calc_mode)}</span>
          <span>·</span>
          <span>{statusLabel(t, course.status)}</span>
          {retakeOfName && (
            <>
              <span>·</span>
              <span className="italic">{t('courses.retakeOf', { name: retakeOfName })}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold">
          {grade.percent !== null ? `${grade.percent.toFixed(1)}% (${grade.letter})` : '—'}
        </span>
        {course.status === 'in_progress' && (
          <button
            type="button"
            onClick={onMarkFailed}
            className="rounded-lg border border-[var(--color-danger)] px-2 py-1 text-xs text-[var(--color-danger)]"
          >
            {t('courses.markFailed')}
          </button>
        )}
        {course.status === 'failed_retaking' && (
          <button
            type="button"
            onClick={onCreateRetake}
            className="rounded-lg bg-[var(--color-accent)] px-2 py-1 text-xs text-[var(--color-accent-contrast)]"
          >
            {t('courses.createRetake')}
          </button>
        )}
      </div>
    </li>
  )
}

interface AddCourseFormProps {
  termId: string
  userId: string
  onCreate: (input: CreateCourseInput) => Promise<void>
  onCancel: () => void
}

function AddCourseForm({ termId, userId, onCreate, onCancel }: AddCourseFormProps) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [credits, setCredits] = useState('3')
  const [calcMode, setCalcMode] = useState<CalcMode>('points')
  const [status, setStatus] = useState<CourseStatus>('in_progress')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onCreate({
        userId,
        termId,
        name: name.trim(),
        credits: Number(credits) || 0,
        calcMode,
        status,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] p-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[var(--color-text-muted)]">{t('courses.courseName')}</label>
        <input
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--color-text-muted)]">{t('courses.credits')}</label>
          <input
            type="number"
            min="0"
            step="0.5"
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--color-text-muted)]">{t('courses.calcMode')}</label>
          <select
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
            value={calcMode}
            onChange={(e) => setCalcMode(e.target.value as CalcMode)}
          >
            {CALC_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {calcModeLabel(t, mode)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[var(--color-text-muted)]">{t('courses.status')}</label>
        <select
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value as CourseStatus)}
        >
          {COURSE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(t, s)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm">
          {t('common.cancel')}
        </button>
        <button
          type="button"
          disabled={!name.trim() || saving}
          onClick={() => void handleSubmit()}
          className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm text-[var(--color-accent-contrast)] disabled:opacity-50"
        >
          {t('common.add')}
        </button>
      </div>
    </div>
  )
}

interface RetakeModalProps {
  course: Course
  terms: Term[]
  userId: string | undefined
  onClose: () => void
  onCreate: (input: CreateCourseInput) => Promise<void>
}

function RetakeModal({ course, terms, userId, onClose, onCreate }: RetakeModalProps) {
  const { t } = useTranslation()
  const [name, setName] = useState(course.name)
  const [credits, setCredits] = useState(String(course.credits))
  const [calcMode, setCalcMode] = useState<CalcMode>(course.calc_mode)
  const [termId, setTermId] = useState(terms[0]?.id ?? '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!userId || !termId || !name.trim()) return
    setSaving(true)
    try {
      await onCreate({
        userId,
        termId,
        name: name.trim(),
        credits: Number(credits) || 0,
        calcMode,
        status: 'in_progress',
        retakeOfCourseId: course.id,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={t('courses.createRetake')} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--color-text-muted)]">{t('courses.courseName')}</label>
          <input
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--color-text-muted)]">{t('courses.targetTerm')}</label>
          <select
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
            value={termId}
            onChange={(e) => setTermId(e.target.value)}
          >
            {terms.map((term) => (
              <option key={term.id} value={term.id}>
                {term.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--color-text-muted)]">{t('courses.credits')}</label>
            <input
              type="number"
              min="0"
              step="0.5"
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--color-text-muted)]">{t('courses.calcMode')}</label>
            <select
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
              value={calcMode}
              onChange={(e) => setCalcMode(e.target.value as CalcMode)}
            >
              {CALC_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {calcModeLabel(t, mode)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm">
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={!name.trim() || !termId || saving}
            onClick={() => void handleSubmit()}
            className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm text-[var(--color-accent-contrast)] disabled:opacity-50"
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
