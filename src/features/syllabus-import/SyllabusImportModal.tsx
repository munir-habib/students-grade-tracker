import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { supabase } from '../../lib/supabase/client'
import { extractSyllabusText, SyllabusExtractionError } from './extractText'

// ---------------------------------------------------------------------------
// Types mirroring the extract-syllabus edge function's response shape
// (supabase/functions/extract-syllabus/index.ts). Kept as a local copy rather
// than a shared import since the edge function is a separate Deno project.
// ---------------------------------------------------------------------------

type ExtractedItem = {
  name: string
  pointsPossible: number
  date: string | null
}

type ExtractedCategory = {
  name: string
  weightPct: number | null
  items: ExtractedItem[]
}

type ExtractResult = {
  categories: ExtractedCategory[]
  warnings: string[]
}

// Editable draft state used by the review screen — same shape plus client-only ids for React keys.
type DraftItem = ExtractedItem & { id: string }
type DraftCategory = { id: string; name: string; weightPct: number | null; items: DraftItem[] }

type Step = 'pick' | 'extracting' | 'analyzing' | 'review' | 'importing' | 'error'

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isValidItem(value: unknown): value is ExtractedItem {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  return typeof item.name === 'string' && isFiniteNumber(item.pointsPossible) && (item.date === null || typeof item.date === 'string')
}

function isValidCategory(value: unknown): value is ExtractedCategory {
  if (typeof value !== 'object' || value === null) return false
  const category = value as Record<string, unknown>
  return (
    typeof category.name === 'string' &&
    (category.weightPct === null || isFiniteNumber(category.weightPct)) &&
    Array.isArray(category.items) &&
    category.items.every(isValidItem)
  )
}

function isValidExtractResult(value: unknown): value is ExtractResult {
  if (typeof value !== 'object' || value === null) return false
  const result = value as Record<string, unknown>
  return (
    Array.isArray(result.categories) &&
    result.categories.every(isValidCategory) &&
    Array.isArray(result.warnings) &&
    result.warnings.every((w) => typeof w === 'string')
  )
}

function toDraft(result: ExtractResult): DraftCategory[] {
  return result.categories.map((category) => ({
    id: newId(),
    name: category.name,
    weightPct: category.weightPct,
    items: category.items.map((item) => ({ ...item, id: newId() })),
  }))
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase()
}

export type SyllabusImportModalProps = {
  /** Course to import categories/assessments into. */
  courseId: string
  open: boolean
  onClose: () => void
  /** Called after a successful import, before onClose. Use to refetch categories/assessments. */
  onImported?: () => void
}

export function SyllabusImportModal({ courseId, open, onClose, onImported }: SyllabusImportModalProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('pick')
  const [fileName, setFileName] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [warningsAck, setWarningsAck] = useState(false)
  const [categories, setCategories] = useState<DraftCategory[]>([])

  function reset() {
    setStep('pick')
    setFileName(null)
    setErrorMessage(null)
    setWarnings([])
    setWarningsAck(false)
    setCategories([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleFileChosen(file: File) {
    setFileName(file.name)
    setErrorMessage(null)

    const lowerName = file.name.toLowerCase()
    if (!lowerName.endsWith('.pdf') && !lowerName.endsWith('.docx')) {
      setErrorMessage(t('syllabusImport.unsupportedFile'))
      setStep('error')
      return
    }

    setStep('extracting')
    let text: string
    try {
      text = await extractSyllabusText(file)
    } catch (err) {
      console.error('Syllabus text extraction failed', err)
      setErrorMessage(err instanceof SyllabusExtractionError ? t('syllabusImport.errorExtract') : t('syllabusImport.errorExtract'))
      setStep('error')
      return
    }

    setStep('analyzing')
    try {
      const { data, error } = await supabase.functions.invoke<ExtractResult>('extract-syllabus', {
        body: { text },
      })

      if (error) throw error
      if (!data || !isValidExtractResult(data)) {
        throw new Error('Unexpected response shape from extract-syllabus')
      }

      setCategories(toDraft(data))
      setWarnings(data.warnings)
      setWarningsAck(data.warnings.length === 0)
      setStep('review')
    } catch (err) {
      console.error('Syllabus analysis failed', err)
      setErrorMessage(t('syllabusImport.errorAnalyze'))
      setStep('error')
    }
  }

  function updateCategory(categoryId: string, patch: Partial<Pick<DraftCategory, 'name' | 'weightPct'>>) {
    setCategories((prev) => prev.map((c) => (c.id === categoryId ? { ...c, ...patch } : c)))
  }

  function removeCategory(categoryId: string) {
    setCategories((prev) => prev.filter((c) => c.id !== categoryId))
  }

  function updateItem(categoryId: string, itemId: string, patch: Partial<Pick<DraftItem, 'name' | 'pointsPossible' | 'date'>>) {
    setCategories((prev) =>
      prev.map((c) => (c.id === categoryId ? { ...c, items: c.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) } : c)),
    )
  }

  function removeItem(categoryId: string, itemId: string) {
    setCategories((prev) => prev.map((c) => (c.id === categoryId ? { ...c, items: c.items.filter((i) => i.id !== itemId) } : c)))
  }

  function addItem(categoryId: string) {
    setCategories((prev) =>
      prev.map((c) =>
        c.id === categoryId ? { ...c, items: [...c.items, { id: newId(), name: '', pointsPossible: 0, date: null }] } : c,
      ),
    )
  }

  function addCategory() {
    setCategories((prev) => [...prev, { id: newId(), name: '', weightPct: null, items: [] }])
  }

  async function handleConfirm() {
    setStep('importing')
    setErrorMessage(null)
    try {
      const { data: existingCategories, error: fetchErr } = await supabase
        .from('categories')
        .select('id, name')
        .eq('course_id', courseId)

      if (fetchErr) throw fetchErr

      const nameToId = new Map<string, string>((existingCategories ?? []).map((c) => [normalizeName(c.name), c.id]))

      const missing = categories.filter((c) => c.name.trim().length > 0 && !nameToId.has(normalizeName(c.name)))
      if (missing.length > 0) {
        const { data: inserted, error: insertErr } = await supabase
          .from('categories')
          .insert(
            missing.map((c) => ({
              course_id: courseId,
              name: c.name.trim(),
              weight_pct: c.weightPct,
              drop_lowest_count: 0,
            })),
          )
          .select('id, name')

        if (insertErr) throw insertErr
        for (const c of inserted ?? []) {
          nameToId.set(normalizeName(c.name), c.id)
        }
      }

      const assessmentsToInsert = categories
        .filter((c) => c.name.trim().length > 0)
        .flatMap((category) => {
          const categoryId = nameToId.get(normalizeName(category.name))
          if (!categoryId) return []
          return category.items
            .filter((item) => item.name.trim().length > 0)
            .map((item) => ({
              category_id: categoryId,
              name: item.name.trim(),
              date: item.date,
              status: 'planned' as const,
              points_possible_syllabus: item.pointsPossible,
              points_possible_actual: item.pointsPossible,
              points_earned: null,
              percent_direct: null,
              comment: null,
            }))
        })

      if (assessmentsToInsert.length > 0) {
        const { error: assessErr } = await supabase.from('assessments').insert(assessmentsToInsert)
        if (assessErr) throw assessErr
      }

      onImported?.()
      handleClose()
    } catch (err) {
      console.error('Syllabus import failed', err)
      setErrorMessage(t('syllabusImport.errorImport'))
      setStep('review')
    }
  }

  if (!open) return null

  const hasAnyItems = categories.some((c) => c.items.length > 0)
  const canConfirm = hasAnyItems && warningsAck && step !== 'importing'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="text-lg font-semibold">{t('syllabusImport.title')}</h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded px-2 py-1 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]"
          >
            {t('common.close')}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {(step === 'pick' || step === 'error') && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-[var(--color-text-muted)]">{t('syllabusImport.supportedFormats')}</p>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-contrast)]"
                >
                  {t('syllabusImport.chooseFile')}
                </button>
                <span className="text-sm text-[var(--color-text-muted)]">{fileName ?? t('syllabusImport.noFileChosen')}</span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleFileChosen(file)
                }}
              />

              {step === 'error' && errorMessage && (
                <div className="rounded border border-[var(--color-danger)] bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
                  {errorMessage}
                </div>
              )}
            </div>
          )}

          {(step === 'extracting' || step === 'analyzing') && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-sm text-[var(--color-text-muted)]">
              <div
                className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]"
                aria-hidden="true"
              />
              <p>{step === 'extracting' ? t('syllabusImport.extracting') : t('syllabusImport.analyzing')}</p>
            </div>
          )}

          {(step === 'review' || step === 'importing') && (
            <div className="flex flex-col gap-5">
              <div>
                <h3 className="text-base font-semibold">{t('syllabusImport.reviewTitle')}</h3>
                <p className="text-sm text-[var(--color-text-muted)]">{t('syllabusImport.reviewHint')}</p>
              </div>

              {warnings.length > 0 && (
                <div className="rounded border-2 border-[var(--color-warning)] bg-[var(--color-warning)]/10 px-4 py-3">
                  <p className="mb-2 text-sm font-semibold text-[var(--color-warning)]">{t('syllabusImport.warningsTitle')}</p>
                  <ul className="mb-3 list-disc space-y-1 pl-5 text-sm">
                    {warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                  <label className="flex items-start gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={warningsAck}
                      onChange={(e) => setWarningsAck(e.target.checked)}
                    />
                    {t('syllabusImport.warningsAck')}
                  </label>
                </div>
              )}

              {!hasAnyItems && (
                <p className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text-muted)]">
                  {t('syllabusImport.noCategoriesFound')}
                </p>
              )}

              {categories.map((category) => (
                <div key={category.id} className="rounded border border-[var(--color-border)] p-4">
                  <div className="mb-3 flex items-end gap-3">
                    <label className="flex-1 text-sm">
                      <span className="mb-1 block text-[var(--color-text-muted)]">{t('syllabusImport.categoryName')}</span>
                      <input
                        type="text"
                        value={category.name}
                        onChange={(e) => updateCategory(category.id, { name: e.target.value })}
                        className="w-full rounded border border-[var(--color-border)] bg-transparent px-2 py-1"
                      />
                    </label>
                    <label className="w-36 text-sm">
                      <span className="mb-1 block text-[var(--color-text-muted)]">{t('syllabusImport.weightPct')}</span>
                      <input
                        type="number"
                        placeholder={t('syllabusImport.weightPctPlaceholder')}
                        value={category.weightPct ?? ''}
                        onChange={(e) =>
                          updateCategory(category.id, { weightPct: e.target.value === '' ? null : Number(e.target.value) })
                        }
                        className="w-full rounded border border-[var(--color-border)] bg-transparent px-2 py-1"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeCategory(category.id)}
                      className="whitespace-nowrap rounded px-2 py-1 text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                    >
                      {t('syllabusImport.removeCategory')}
                    </button>
                  </div>

                  <div className="flex flex-col gap-2">
                    {category.items.map((item) => (
                      <div key={item.id} className="flex items-end gap-2">
                        <label className="flex-1 text-sm">
                          <span className="mb-1 block text-[var(--color-text-muted)]">{t('syllabusImport.itemName')}</span>
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => updateItem(category.id, item.id, { name: e.target.value })}
                            className="w-full rounded border border-[var(--color-border)] bg-transparent px-2 py-1"
                          />
                        </label>
                        <label className="w-28 text-sm">
                          <span className="mb-1 block text-[var(--color-text-muted)]">{t('syllabusImport.pointsPossible')}</span>
                          <input
                            type="number"
                            value={item.pointsPossible}
                            onChange={(e) => updateItem(category.id, item.id, { pointsPossible: Number(e.target.value) })}
                            className="w-full rounded border border-[var(--color-border)] bg-transparent px-2 py-1"
                          />
                        </label>
                        <label className="w-36 text-sm">
                          <span className="mb-1 block text-[var(--color-text-muted)]">{t('syllabusImport.date')}</span>
                          <input
                            type="date"
                            value={item.date ?? ''}
                            onChange={(e) => updateItem(category.id, item.id, { date: e.target.value === '' ? null : e.target.value })}
                            className="w-full rounded border border-[var(--color-border)] bg-transparent px-2 py-1"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => removeItem(category.id, item.id)}
                          className="whitespace-nowrap rounded px-2 py-1 text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                        >
                          {t('syllabusImport.removeItem')}
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addItem(category.id)}
                      className="mt-1 self-start rounded border border-[var(--color-border)] px-3 py-1 text-sm hover:bg-[var(--color-surface)]"
                    >
                      {t('syllabusImport.addItem')}
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addCategory}
                className="self-start rounded border border-[var(--color-border)] px-3 py-1 text-sm hover:bg-[var(--color-surface)]"
              >
                {t('syllabusImport.addCategory')}
              </button>

              {errorMessage && (
                <div className="rounded border border-[var(--color-danger)] bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
                  {errorMessage}
                </div>
              )}
            </div>
          )}
        </div>

        {(step === 'review' || step === 'importing') && (
          <div className="flex items-center justify-between border-t border-[var(--color-border)] px-5 py-4">
            <button type="button" onClick={reset} className="rounded px-3 py-2 text-sm text-[var(--color-text-muted)]">
              {t('syllabusImport.startOver')}
            </button>
            <button
              type="button"
              disabled={!canConfirm}
              onClick={() => void handleConfirm()}
              className="rounded bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-contrast)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {step === 'importing' ? t('syllabusImport.importing') : t('syllabusImport.confirmImport')}
            </button>
          </div>
        )}

        {step === 'error' && (
          <div className="flex items-center justify-end border-t border-[var(--color-border)] px-5 py-4">
            <button
              type="button"
              onClick={reset}
              className="rounded bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-contrast)]"
            >
              {t('syllabusImport.tryAgain')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export type SyllabusImportButtonProps = {
  courseId: string
  onImported?: () => void
}

/** Self-contained trigger + modal, for callers that don't want to manage `open` state themselves. */
export function SyllabusImportButton({ courseId, onImported }: SyllabusImportButtonProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-contrast)]"
      >
        {t('courses.importSyllabus')}
      </button>
      <SyllabusImportModal courseId={courseId} open={open} onClose={() => setOpen(false)} onImported={onImported} />
    </>
  )
}
