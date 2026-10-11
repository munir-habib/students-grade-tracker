import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '../../lib/supabase/client'
import type { Term } from '../../lib/supabase/types'

export const termsQueryKey = (userId: string | undefined) => ['terms', userId] as const

export function useTerm(termId: string | undefined) {
  return useQuery({
    queryKey: ['term', termId] as const,
    queryFn: async () => {
      const { data, error } = await supabase.from('terms').select('*').eq('id', termId as string).single()
      if (error) throw error
      return data
    },
    enabled: !!termId,
  })
}

export function useTerms(userId: string | undefined) {
  return useQuery({
    queryKey: termsQueryKey(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('terms')
        .select('*')
        .eq('user_id', userId as string)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!userId,
  })
}

export interface CreateTermInput {
  userId: string
  name: string
  startsOn: string | null
  endsOn: string | null
  sortOrder: number
}

export function useCreateTerm() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateTermInput) => {
      const { error } = await supabase.from('terms').insert({
        user_id: input.userId,
        name: input.name,
        starts_on: input.startsOn,
        ends_on: input.endsOn,
        sort_order: input.sortOrder,
      })
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: termsQueryKey(variables.userId) })
    },
  })
}

/** Next sort_order for a new term appended at the end of the list. */
export function nextTermSortOrder(terms: Term[] | undefined): number {
  if (!terms || terms.length === 0) return 0
  return Math.max(...terms.map((t) => t.sort_order)) + 1
}
