import { useQueries, useQuery } from '@tanstack/react-query'

import { DEFAULT_GRADE_SCALE, type GradeBand } from '../../lib/calc/gradeScale'
import { supabase } from '../../lib/supabase/client'

function bandsToGradeBands(bands: { min_pct: number; letter: string; gpa_points: number }[]): GradeBand[] {
  return bands.map((b) => ({ minPct: b.min_pct, letter: b.letter, gpaPoints: b.gpa_points }))
}

/** The system default grade scale (grade_scales.user_id is null), fetched by id then bands. */
export async function fetchDefaultGradeScale(): Promise<GradeBand[]> {
  const { data: scales, error } = await supabase.from('grade_scales').select('*').is('user_id', null)
  if (error) throw error
  const scaleIds = scales.map((s) => s.id)
  if (scaleIds.length === 0) return DEFAULT_GRADE_SCALE
  const { data: bands, error: bandsError } = await supabase.from('grade_scale_bands').select('*').in('scale_id', scaleIds)
  if (bandsError) throw bandsError
  if (bands.length === 0) return DEFAULT_GRADE_SCALE
  return bandsToGradeBands(bands)
}

export async function fetchGradeScaleById(scaleId: string): Promise<GradeBand[]> {
  const { data: bands, error } = await supabase.from('grade_scale_bands').select('*').eq('scale_id', scaleId)
  if (error) throw error
  return bandsToGradeBands(bands)
}

export const defaultGradeScaleQueryKey = ['grade-scale-bands', 'default'] as const
export const gradeScaleQueryKey = (scaleId: string) => ['grade-scale-bands', scaleId] as const

export function useDefaultGradeScale() {
  return useQuery({
    queryKey: defaultGradeScaleQueryKey,
    queryFn: fetchDefaultGradeScale,
    staleTime: Infinity,
  })
}

/** Resolves the effective grade scale for a single course: its override if set, else the default. */
export function useCourseGradeScale(gradeScaleId: string | null | undefined) {
  const defaultScale = useDefaultGradeScale()
  const overrideScale = useQuery({
    queryKey: gradeScaleId ? gradeScaleQueryKey(gradeScaleId) : ['grade-scale-bands', 'none'],
    queryFn: () => fetchGradeScaleById(gradeScaleId as string),
    enabled: !!gradeScaleId,
    staleTime: Infinity,
  })

  const scale = gradeScaleId ? (overrideScale.data ?? defaultScale.data ?? DEFAULT_GRADE_SCALE) : (defaultScale.data ?? DEFAULT_GRADE_SCALE)
  const isLoading = gradeScaleId ? overrideScale.isLoading || defaultScale.isLoading : defaultScale.isLoading
  return { scale, isLoading }
}

/** Resolves effective grade scales for many courses at once (for list views), keyed by course id. */
export function useGradeScalesForCourses(courses: { id: string; grade_scale_id: string | null }[] | undefined) {
  const defaultScale = useDefaultGradeScale()
  const customScaleIds = [...new Set((courses ?? []).map((c) => c.grade_scale_id).filter((id): id is string => !!id))]

  const overrideQueries = useQueries({
    queries: customScaleIds.map((scaleId) => ({
      queryKey: gradeScaleQueryKey(scaleId),
      queryFn: () => fetchGradeScaleById(scaleId),
      staleTime: Infinity,
    })),
  })

  const overrideMap = new Map<string, GradeBand[]>()
  customScaleIds.forEach((id, i) => {
    const data = overrideQueries[i]?.data
    if (data) overrideMap.set(id, data)
  })

  const scaleFor = (course: { grade_scale_id: string | null }): GradeBand[] => {
    if (course.grade_scale_id) {
      return overrideMap.get(course.grade_scale_id) ?? defaultScale.data ?? DEFAULT_GRADE_SCALE
    }
    return defaultScale.data ?? DEFAULT_GRADE_SCALE
  }

  return { scaleFor, isLoading: defaultScale.isLoading || overrideQueries.some((q) => q.isLoading) }
}
