import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { totalsForCourse } from '../courses/calcAdapters'
import { pctToBand, letterShortcuts, type GradeBand } from '../../lib/calc/gradeScale'
import { simulateTargetGrade, simulatePerAssessmentScenario, type HypotheticalScore } from '../../lib/calc/simulator'
import type { CalcCategory } from '../../lib/calc/types'
import type { Assessment, CalcMode } from '../../lib/supabase/types'

interface SimulatorPanelProps {
  calcMode: CalcMode
  categories: CalcCategory[]
  pendingOrPlanned: Assessment[]
  scale: GradeBand[]
}

function pointsPossibleOf(a: Assessment): number {
  return a.points_possible_actual ?? a.points_possible_syllabus ?? 100
}

export function SimulatorPanel({ calcMode, categories, pendingOrPlanned, scale }: SimulatorPanelProps) {
  const { t } = useTranslation()
  const totals = totalsForCourse(calcMode, categories)
  const currentLetter = totals.percent !== null ? pctToBand(totals.percent, scale).letter : null

  const [targetLetter, setTargetLetter] = useState<string | null>(null)
  const result = targetLetter ? simulateTargetGrade(totals, targetLetter, scale) : null

  const [scores, setScores] = useState<Record<string, number>>({})

  const hypotheticals: HypotheticalScore[] = pendingOrPlanned.map((a) => {
    const possible = pointsPossibleOf(a)
    const earned = scores[a.id] ?? possible
    return { assessmentId: a.id, pointsEarned: earned, pointsPossible: possible }
  })
  const scenarioTotals =
    pendingOrPlanned.length > 0 ? simulatePerAssessmentScenario(categories, calcMode, hypotheticals) : null
  const scenarioLetter = scenarioTotals?.percent != null ? pctToBand(scenarioTotals.percent, scale).letter : null

  return (
    <section className="flex flex-col gap-5 rounded-xl border border-[var(--color-border)] p-4">
      <div>
        <h2 className="text-sm font-semibold">{t('courses.gradeScale')}</h2>
        <p className="mt-1 text-lg font-semibold">
          {totals.percent !== null ? `${totals.percent.toFixed(1)}% (${currentLetter})` : '—'}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">{t('simulator.title')}</h3>
        <p className="text-xs text-[var(--color-text-muted)]">{t('simulator.targetGrade')}</p>
        <div className="flex flex-wrap gap-1.5">
          {letterShortcuts(scale).map((letter) => (
            <button
              key={letter}
              type="button"
              onClick={() => setTargetLetter(letter)}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                targetLetter === letter
                  ? 'bg-[var(--color-accent)] text-[var(--color-accent-contrast)]'
                  : 'border border-[var(--color-border)]'
              }`}
            >
              {letter}
            </button>
          ))}
        </div>
        {result && (
          <p className="rounded-lg bg-[var(--color-surface)] p-3 text-sm">
            {result.kind === 'guaranteed' && t('simulator.resultGuaranteed', { letter: result.letter })}
            {result.kind === 'achievable' &&
              t('simulator.resultAchievable', {
                percent: result.neededPercentOnRest.toFixed(1),
                letter: result.letter,
              })}
            {result.kind === 'impossible' &&
              t('simulator.resultImpossible', { letter: result.letter, ceilingLetter: result.ceilingLetter })}
          </p>
        )}
      </div>

      {pendingOrPlanned.length > 0 && (
        <div className="flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-semibold">{t('simulator.playItMyWay')}</h3>
            <p className="text-xs text-[var(--color-text-muted)]">{t('simulator.playItMyWayHint')}</p>
          </div>

          <div className="flex flex-col gap-3">
            {pendingOrPlanned.map((a) => {
              const possible = pointsPossibleOf(a)
              const value = scores[a.id] ?? possible
              return (
                <div key={a.id} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <span>{a.name}</span>
                    <span className="text-[var(--color-text-muted)]">
                      {value}/{possible}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={possible}
                    step="0.5"
                    value={value}
                    onChange={(e) => setScores((s) => ({ ...s, [a.id]: Number(e.target.value) }))}
                    className="w-full accent-[var(--color-accent)]"
                  />
                </div>
              )
            })}
          </div>

          <p className="rounded-lg bg-[var(--color-surface)] p-3 text-sm font-medium">
            {scenarioTotals?.percent != null ? `${scenarioTotals.percent.toFixed(1)}% (${scenarioLetter})` : '—'}
          </p>
        </div>
      )}
    </section>
  )
}
