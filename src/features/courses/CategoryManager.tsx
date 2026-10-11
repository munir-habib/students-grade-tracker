import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useCreateCategory, useDeleteCategory, useUpdateCategory } from './categoriesApi'
import type { CalcMode, Category } from '../../lib/supabase/types'

interface CategoryManagerProps {
  courseId: string
  calcMode: CalcMode
  categories: Category[]
}

export function CategoryManager({ courseId, calcMode, categories }: CategoryManagerProps) {
  const { t } = useTranslation()
  const createCategory = useCreateCategory()
  const [showAdd, setShowAdd] = useState(false)

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t('courses.categories')}</h2>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm"
        >
          {t('courses.addCategory')}
        </button>
      </div>

      {showAdd && (
        <CategoryForm
          calcMode={calcMode}
          onCancel={() => setShowAdd(false)}
          onSubmit={async (values) => {
            await createCategory.mutateAsync({ courseId, ...values })
            setShowAdd(false)
          }}
        />
      )}

      {categories.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">{t('common.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {categories.map((category) => (
            <CategoryRow key={category.id} courseId={courseId} calcMode={calcMode} category={category} />
          ))}
        </ul>
      )}
    </section>
  )
}

interface CategoryFormValues {
  name: string
  weightPct: number | null
  dropLowestCount: number
}

interface CategoryFormProps {
  calcMode: CalcMode
  initial?: Category
  onCancel: () => void
  onSubmit: (values: CategoryFormValues) => Promise<void>
}

function CategoryForm({ calcMode, initial, onCancel, onSubmit }: CategoryFormProps) {
  const { t } = useTranslation()
  const [name, setName] = useState(initial?.name ?? '')
  const [weightPct, setWeightPct] = useState(initial?.weight_pct != null ? String(initial.weight_pct) : '')
  const [dropLowest, setDropLowest] = useState(String(initial?.drop_lowest_count ?? 0))
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSubmit({
        name: name.trim(),
        weightPct: calcMode === 'category_percentage' && weightPct !== '' ? Number(weightPct) : null,
        dropLowestCount: Number(dropLowest) || 0,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] p-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[var(--color-text-muted)]">{t('courses.categoryName')}</label>
        <input
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {calcMode === 'category_percentage' && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--color-text-muted)]">{t('courses.weightPct')}</label>
            <input
              type="number"
              min="0"
              max="100"
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
              value={weightPct}
              onChange={(e) => setWeightPct(e.target.value)}
            />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--color-text-muted)]">{t('courses.dropLowest')}</label>
          <input
            type="number"
            min="0"
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
            value={dropLowest}
            onChange={(e) => setDropLowest(e.target.value)}
          />
        </div>
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
          {t('common.save')}
        </button>
      </div>
    </div>
  )
}

function CategoryRow({
  courseId,
  calcMode,
  category,
}: {
  courseId: string
  calcMode: CalcMode
  category: Category
}) {
  const { t } = useTranslation()
  const updateCategory = useUpdateCategory(courseId)
  const deleteCategory = useDeleteCategory(courseId)
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <CategoryForm
        calcMode={calcMode}
        initial={category}
        onCancel={() => setEditing(false)}
        onSubmit={async (values) => {
          await updateCategory.mutateAsync({
            id: category.id,
            patch: { name: values.name, weight_pct: values.weightPct, drop_lowest_count: values.dropLowestCount },
          })
          setEditing(false)
        }}
      />
    )
  }

  return (
    <li className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm">
      <div className="flex flex-col">
        <span className="font-medium">{category.name}</span>
        <span className="text-xs text-[var(--color-text-muted)]">
          {calcMode === 'category_percentage' && category.weight_pct !== null
            ? `${t('courses.weightPct')}: ${category.weight_pct}%`
            : null}
          {category.drop_lowest_count > 0
            ? `${calcMode === 'category_percentage' && category.weight_pct !== null ? ' · ' : ''}${t('courses.dropLowest')}: ${category.drop_lowest_count}`
            : null}
        </span>
      </div>
      <div className="flex gap-1">
        <button type="button" onClick={() => setEditing(true)} className="rounded-lg px-2 py-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
          {t('common.edit')}
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`${t('common.delete')} "${category.name}"?`)) void deleteCategory.mutateAsync(category.id)
          }}
          className="rounded-lg px-2 py-1 text-xs text-[var(--color-danger)]"
        >
          {t('common.delete')}
        </button>
      </div>
    </li>
  )
}
