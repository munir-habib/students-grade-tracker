import { DndContext, PointerSensor, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { AssessmentCard } from './AssessmentCard'
import { AssessmentForm } from '../assessments/AssessmentForm'
import { useUpdateAssessment } from '../assessments/assessmentsApi'
import type { Assessment, AssessmentStatus, Category } from '../../lib/supabase/types'

const STATUSES: AssessmentStatus[] = ['planned', 'pending', 'completed']

interface BoardProps {
  courseId: string
  categories: Category[]
  assessments: Assessment[]
}

export function Board({ courseId, categories, assessments }: BoardProps) {
  const updateAssessment = useUpdateAssessment(courseId)
  const [editing, setEditing] = useState<Assessment | null>(null)
  const [editingTargetStatus, setEditingTargetStatus] = useState<AssessmentStatus | undefined>(undefined)
  const [creatingForStatus, setCreatingForStatus] = useState<AssessmentStatus | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const categoryById = new Map(categories.map((c) => [c.id, c]))

  const moveTo = (assessment: Assessment, status: AssessmentStatus) => {
    if (status === assessment.status) return
    if (status === 'completed') {
      // Completing a card always goes through the mini-form so the grade can be entered.
      setEditing(assessment)
      setEditingTargetStatus('completed')
    } else {
      void updateAssessment.mutateAsync({ id: assessment.id, patch: { status } })
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const overStatus = event.over?.id as AssessmentStatus | undefined
    if (!overStatus) return
    const assessment = assessments.find((a) => a.id === event.active.id)
    if (!assessment) return
    moveTo(assessment, overStatus)
  }

  return (
    <div>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {STATUSES.map((status) => (
            <Column
              key={status}
              status={status}
              assessments={assessments.filter((a) => a.status === status)}
              categoryById={categoryById}
              onEdit={(a) => {
                setEditing(a)
                setEditingTargetStatus(undefined)
              }}
              onMoveTo={moveTo}
              onAdd={() => setCreatingForStatus(status)}
              canAdd={categories.length > 0}
            />
          ))}
        </div>
      </DndContext>

      {editing && (
        <AssessmentForm
          courseId={courseId}
          categories={categories}
          initial={editing}
          defaultStatus={editingTargetStatus}
          onClose={() => setEditing(null)}
        />
      )}
      {creatingForStatus && (
        <AssessmentForm
          courseId={courseId}
          categories={categories}
          defaultStatus={creatingForStatus}
          onClose={() => setCreatingForStatus(null)}
        />
      )}
    </div>
  )
}

interface ColumnProps {
  status: AssessmentStatus
  assessments: Assessment[]
  categoryById: Map<string, Category>
  onEdit: (a: Assessment) => void
  onMoveTo: (a: Assessment, status: AssessmentStatus) => void
  onAdd: () => void
  canAdd: boolean
}

function Column({ status, assessments, categoryById, onEdit, onMoveTo, onAdd, canAdd }: ColumnProps) {
  const { t } = useTranslation()
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[8rem] flex-col gap-2 rounded-xl border p-3 transition-colors ${
        isOver ? 'border-[var(--color-accent)] bg-[var(--color-surface)]' : 'border-[var(--color-border)]'
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t(`board.${status}`)}</h3>
        <button
          type="button"
          disabled={!canAdd}
          onClick={onAdd}
          className="rounded-md px-2 py-0.5 text-xs text-[var(--color-accent)] disabled:opacity-30"
        >
          + {t('common.add')}
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {assessments.length === 0 && <p className="text-xs text-[var(--color-text-muted)]">{t('common.empty')}</p>}
        {assessments.map((assessment) => (
          <AssessmentCard
            key={assessment.id}
            assessment={assessment}
            category={categoryById.get(assessment.category_id)}
            onEdit={() => onEdit(assessment)}
            onMoveTo={(next) => onMoveTo(assessment, next)}
          />
        ))}
      </div>
    </div>
  )
}
