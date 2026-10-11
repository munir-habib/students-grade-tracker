import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useTranslation } from 'react-i18next'

import { categoryColor } from './categoryColor'
import type { Assessment, AssessmentStatus, Category } from '../../lib/supabase/types'

const STATUS_ORDER: AssessmentStatus[] = ['planned', 'pending', 'completed']

function scoreLabel(a: Assessment): string | null {
  if (a.percent_direct !== null) return `${a.percent_direct}%`
  const possible = a.points_possible_actual ?? a.points_possible_syllabus
  if (a.points_earned !== null && possible !== null) return `${a.points_earned}/${possible}`
  if (possible !== null) return `— / ${possible}`
  return null
}

interface AssessmentCardProps {
  assessment: Assessment
  category: Category | undefined
  onEdit: () => void
  onMoveTo: (status: AssessmentStatus) => void
}

export function AssessmentCard({ assessment, category, onEdit, onMoveTo }: AssessmentCardProps) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: assessment.id })

  const statusIndex = STATUS_ORDER.indexOf(assessment.status)
  const prevStatus = statusIndex > 0 ? STATUS_ORDER[statusIndex - 1] : null
  const nextStatus = statusIndex < STATUS_ORDER.length - 1 ? STATUS_ORDER[statusIndex + 1] : null

  const style = transform
    ? { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.6 : 1, zIndex: isDragging ? 10 : undefined }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="flex touch-manipulation flex-col gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2.5 text-sm shadow-sm"
    >
      <button type="button" onClick={onEdit} className="flex w-full flex-col gap-1 text-left">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
            <span
              className="inline-block size-2 shrink-0 rounded-full"
              style={{ backgroundColor: category ? categoryColor(category.id) : '#9ca3af' }}
            />
            {category?.name ?? ''}
          </span>
          {assessment.comment && (
            <span title={t('board.comment')} aria-label={t('board.comment')} className="text-xs">
              💬
            </span>
          )}
        </div>
        <span className="font-medium">{assessment.name}</span>
        <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
          {scoreLabel(assessment) && <span>{scoreLabel(assessment)}</span>}
          {assessment.date && <span>{assessment.date}</span>}
        </div>
      </button>

      {/* Tap-to-cycle controls: the primary way to change status on narrow/touch screens, where
          precise drag-and-drop is hard. Drag (via dnd-kit above) remains available at all sizes,
          but is the primary interaction only at md: and up. */}
      <div className="flex gap-1 md:hidden">
        <button
          type="button"
          disabled={!prevStatus}
          aria-label={t('board.moveBack')}
          onClick={(e) => {
            e.stopPropagation()
            if (prevStatus) onMoveTo(prevStatus)
          }}
          className="flex-1 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs disabled:opacity-30"
        >
          ← {t('board.moveBack')}
        </button>
        <button
          type="button"
          disabled={!nextStatus}
          aria-label={t('board.moveForward')}
          onClick={(e) => {
            e.stopPropagation()
            if (nextStatus) onMoveTo(nextStatus)
          }}
          className="flex-1 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs disabled:opacity-30"
        >
          {t('board.moveForward')} →
        </button>
      </div>
    </div>
  )
}
