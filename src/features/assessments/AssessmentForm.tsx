import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useCreateAssessment, useUpdateAssessment, type AssessmentFormPayload } from './assessmentsApi'
import { Modal } from '../courses/Modal'
import type { Assessment, AssessmentStatus, Category } from '../../lib/supabase/types'

type GradeMode = 'none' | 'points' | 'percent'

interface AssessmentFormProps {
  courseId: string
  categories: Category[]
  initial?: Assessment
  defaultCategoryId?: string
  defaultStatus?: AssessmentStatus
  onClose: () => void
}

function initialGradeMode(a: Assessment | undefined): GradeMode {
  if (!a) return 'none'
  if (a.percent_direct !== null) return 'percent'
  if (a.points_earned !== null) return 'points'
  return 'none'
}

export function AssessmentForm({ courseId, categories, initial, defaultCategoryId, defaultStatus, onClose }: AssessmentFormProps) {
  const { t } = useTranslation()
  const createAssessment = useCreateAssessment(courseId)
  const updateAssessment = useUpdateAssessment(courseId)

  const [name, setName] = useState(initial?.name ?? '')
  const [date, setDate] = useState(initial?.date ?? '')
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? defaultCategoryId ?? categories[0]?.id ?? '')
  // defaultStatus wins over the assessment's current status: it signals an explicit intent (e.g.
  // "move this card to Completed"), whereas initial?.status is just where the card already sits.
  const [status, setStatus] = useState<AssessmentStatus>(defaultStatus ?? initial?.status ?? 'planned')
  const [pointsPossibleSyllabus, setPointsPossibleSyllabus] = useState(
    initial?.points_possible_syllabus != null ? String(initial.points_possible_syllabus) : '',
  )
  const [pointsPossibleActual, setPointsPossibleActual] = useState(
    initial?.points_possible_actual != null ? String(initial.points_possible_actual) : '',
  )
  const [pointsEarned, setPointsEarned] = useState(initial?.points_earned != null ? String(initial.points_earned) : '')
  const [percentDirect, setPercentDirect] = useState(initial?.percent_direct != null ? String(initial.percent_direct) : '')
  const [gradeMode, setGradeMode] = useState<GradeMode>(initialGradeMode(initial))
  const [comment, setComment] = useState(initial?.comment ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  const isEdit = !!initial

  const handleSubmit = async () => {
    if (!name.trim() || !categoryId) return
    if (gradeMode === 'points' && (pointsEarned === '' || (pointsPossibleActual === '' && pointsPossibleSyllabus === ''))) {
      setError(true)
      return
    }
    if (gradeMode === 'percent' && percentDirect === '') {
      setError(true)
      return
    }
    setError(false)
    setSaving(true)
    try {
      // Hard mutual-exclusivity, mirroring the DB check constraint: at most one of
      // points_earned / percent_direct is ever sent — never both.
      const hasGrade = gradeMode !== 'none'
      const payload: AssessmentFormPayload = {
        category_id: categoryId,
        name: name.trim(),
        date: date || null,
        status: hasGrade ? 'completed' : status,
        points_possible_syllabus: pointsPossibleSyllabus !== '' ? Number(pointsPossibleSyllabus) : null,
        points_possible_actual:
          gradeMode === 'points'
            ? Number(pointsPossibleActual || pointsPossibleSyllabus)
            : pointsPossibleActual !== ''
              ? Number(pointsPossibleActual)
              : null,
        points_earned: gradeMode === 'points' ? Number(pointsEarned) : null,
        percent_direct: gradeMode === 'percent' ? Number(percentDirect) : null,
        comment: comment.trim() || null,
      }

      if (isEdit && initial) {
        await updateAssessment.mutateAsync({ id: initial.id, patch: payload })
      } else {
        await createAssessment.mutateAsync(payload)
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={isEdit ? t('common.edit') : t('board.addAssessment')} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--color-text-muted)]">{t('board.assessmentName')}</label>
          <input
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('board.assessmentName')}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--color-text-muted)]">{t('board.category')}</label>
            <select
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--color-text-muted)]">{t('board.date')}</label>
            <input
              type="date"
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--color-text-muted)]">{t('courses.status')}</label>
          <select
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm disabled:opacity-50"
            value={gradeMode !== 'none' ? 'completed' : status}
            disabled={gradeMode !== 'none'}
            onChange={(e) => setStatus(e.target.value as AssessmentStatus)}
          >
            <option value="planned">{t('board.planned')}</option>
            <option value="pending">{t('board.pending')}</option>
            <option value="completed">{t('board.completed')}</option>
          </select>
          {gradeMode !== 'none' && (
            <p className="text-xs text-[var(--color-text-muted)]">{t('board.markCompleted')}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--color-text-muted)]">{t('board.pointsPossibleSyllabus')}</label>
          <input
            type="number"
            min="0"
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
            value={pointsPossibleSyllabus}
            onChange={(e) => setPointsPossibleSyllabus(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-[var(--color-border)] p-3">
          <div className="flex gap-1">
            {(['none', 'points', 'percent'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setGradeMode(mode)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs ${
                  gradeMode === mode
                    ? 'bg-[var(--color-accent)] text-[var(--color-accent-contrast)]'
                    : 'border border-[var(--color-border)] text-[var(--color-text-muted)]'
                }`}
              >
                {mode === 'none' && '—'}
                {mode === 'points' && t('board.byPoints')}
                {mode === 'percent' && t('board.byPercent')}
              </button>
            ))}
          </div>

          {gradeMode === 'points' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[var(--color-text-muted)]">{t('board.pointsEarned')}</label>
                <input
                  type="number"
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
                  value={pointsEarned}
                  onChange={(e) => setPointsEarned(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[var(--color-text-muted)]">{t('board.pointsPossible')}</label>
                <input
                  type="number"
                  min="0"
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
                  value={pointsPossibleActual}
                  placeholder={pointsPossibleSyllabus}
                  onChange={(e) => setPointsPossibleActual(e.target.value)}
                />
              </div>
            </div>
          )}

          {gradeMode === 'percent' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--color-text-muted)]">{t('board.percentDirect')}</label>
              <input
                type="number"
                min="0"
                max="100"
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
                value={percentDirect}
                onChange={(e) => setPercentDirect(e.target.value)}
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Comment: deliberately styled apart from the grade inputs above (dashed border, muted
            surface) so it never gets mistaken for a grade field the way the old spreadsheet's
            notes column did. */}
        <div className="flex flex-col gap-1 rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <label className="text-xs font-medium text-[var(--color-text-muted)]">{t('board.comment')}</label>
          <textarea
            className="resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <p className="text-[11px] italic text-[var(--color-text-muted)]">{t('board.commentHint')}</p>
        </div>

        {error && <p className="text-xs text-[var(--color-danger)]">{t('common.loadError')}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm">
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={!name.trim() || !categoryId || saving}
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
