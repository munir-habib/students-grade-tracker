export interface GradeBand {
  minPct: number
  letter: string
  gpaPoints: number
}

/** Default US GPA scale (spec §3) — overridable per course. */
export const DEFAULT_GRADE_SCALE: GradeBand[] = [
  { minPct: 93, letter: 'A', gpaPoints: 4.0 },
  { minPct: 90, letter: 'A-', gpaPoints: 3.7 },
  { minPct: 87, letter: 'B+', gpaPoints: 3.3 },
  { minPct: 83, letter: 'B', gpaPoints: 3.0 },
  { minPct: 80, letter: 'B-', gpaPoints: 2.7 },
  { minPct: 77, letter: 'C+', gpaPoints: 2.3 },
  { minPct: 73, letter: 'C', gpaPoints: 2.0 },
  { minPct: 70, letter: 'C-', gpaPoints: 1.7 },
  { minPct: 0, letter: 'F', gpaPoints: 0.0 },
]

function sortedDescending(scale: GradeBand[]): GradeBand[] {
  return [...scale].sort((a, b) => b.minPct - a.minPct)
}

export function pctToBand(pct: number, scale: GradeBand[] = DEFAULT_GRADE_SCALE): GradeBand {
  const sorted = sortedDescending(scale)
  return sorted.find((b) => pct >= b.minPct) ?? sorted[sorted.length - 1]
}

export function minPctForLetter(letter: string, scale: GradeBand[] = DEFAULT_GRADE_SCALE): number | null {
  return scale.find((b) => b.letter === letter)?.minPct ?? null
}

/** Letter shortcuts for the simulator's tap targets, best-to-worst, excluding F. */
export function letterShortcuts(scale: GradeBand[] = DEFAULT_GRADE_SCALE): string[] {
  return sortedDescending(scale)
    .map((b) => b.letter)
    .filter((letter) => letter !== 'F')
}
