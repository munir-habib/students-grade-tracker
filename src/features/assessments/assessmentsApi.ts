import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '../../lib/supabase/client'
import type { Assessment, AssessmentStatus } from '../../lib/supabase/types'

export const assessmentsQueryKey = (courseId: string | undefined) => ['assessments', courseId] as const

/**
 * Assessments hang off categories, not courses directly, so listing "this course's assessments"
 * is a two-step fetch: category ids for the course, then assessments in those categories.
 */
export function useAssessments(courseId: string | undefined, categoryIds: string[]) {
  return useQuery({
    queryKey: assessmentsQueryKey(courseId),
    queryFn: async () => {
      if (categoryIds.length === 0) return [] as Assessment[]
      const { data, error } = await supabase.from('assessments').select('*').in('category_id', categoryIds)
      if (error) throw error
      return data
    },
    enabled: !!courseId,
  })
}

export interface AssessmentGradeFields {
  points_possible_syllabus: number | null
  points_possible_actual: number | null
  points_earned: number | null
  percent_direct: number | null
}

export interface AssessmentFormPayload extends AssessmentGradeFields {
  category_id: string
  name: string
  date: string | null
  status: AssessmentStatus
  comment: string | null
}

export function useCreateAssessment(courseId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: AssessmentFormPayload) => {
      const { error } = await supabase.from('assessments').insert(payload)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: assessmentsQueryKey(courseId) })
    },
  })
}

export function useUpdateAssessment(courseId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Assessment> }) => {
      const { error } = await supabase.from('assessments').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: assessmentsQueryKey(courseId) })
    },
  })
}

export function useDeleteAssessment(courseId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assessments').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: assessmentsQueryKey(courseId) })
    },
  })
}
