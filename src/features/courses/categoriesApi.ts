import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { assessmentsQueryKey } from '../assessments/assessmentsApi'
import { supabase } from '../../lib/supabase/client'
import type { Category } from '../../lib/supabase/types'

export const categoriesQueryKey = (courseId: string | undefined) => ['categories', courseId] as const

export function useCategories(courseId: string | undefined) {
  return useQuery({
    queryKey: categoriesQueryKey(courseId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('course_id', courseId as string)
        .order('name', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!courseId,
  })
}

export interface CreateCategoryInput {
  courseId: string
  name: string
  weightPct: number | null
  dropLowestCount: number
}

export function useCreateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateCategoryInput) => {
      const { error } = await supabase.from('categories').insert({
        course_id: input.courseId,
        name: input.name,
        weight_pct: input.weightPct,
        drop_lowest_count: input.dropLowestCount,
      })
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: categoriesQueryKey(variables.courseId) })
    },
  })
}

export function useUpdateCategory(courseId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Category> }) => {
      const { error } = await supabase.from('categories').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoriesQueryKey(courseId) })
    },
  })
}

export function useDeleteCategory(courseId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      // Deleting a category cascades to delete its assessments (DB FK), so both caches are stale.
      void queryClient.invalidateQueries({ queryKey: categoriesQueryKey(courseId) })
      void queryClient.invalidateQueries({ queryKey: assessmentsQueryKey(courseId) })
    },
  })
}
