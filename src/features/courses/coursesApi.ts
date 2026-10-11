import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '../../lib/supabase/client'
import type { CalcMode, Course, CourseStatus } from '../../lib/supabase/types'

export const coursesQueryKey = (userId: string | undefined) => ['courses', userId] as const
export const courseQueryKey = (courseId: string | undefined) => ['course', courseId] as const

export function useCourses(userId: string | undefined) {
  return useQuery({
    queryKey: coursesQueryKey(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('user_id', userId as string)
        .order('name', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!userId,
  })
}

export function useCourse(courseId: string | undefined) {
  return useQuery({
    queryKey: courseQueryKey(courseId),
    queryFn: async () => {
      const { data, error } = await supabase.from('courses').select('*').eq('id', courseId as string).single()
      if (error) throw error
      return data
    },
    enabled: !!courseId,
  })
}

export interface CreateCourseInput {
  userId: string
  termId: string
  name: string
  credits: number
  calcMode: CalcMode
  status: CourseStatus
  retakeOfCourseId?: string | null
}

export function useCreateCourse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateCourseInput) => {
      const { data, error } = await supabase
        .from('courses')
        .insert({
          user_id: input.userId,
          term_id: input.termId,
          name: input.name,
          credits: input.credits,
          calc_mode: input.calcMode,
          status: input.status,
          retake_of_course_id: input.retakeOfCourseId ?? null,
          grade_scale_id: null,
        })
        .select('*')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: coursesQueryKey(variables.userId) })
    },
  })
}

export function useUpdateCourse(userId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Course> }) => {
      const { error } = await supabase.from('courses').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: coursesQueryKey(userId) })
      void queryClient.invalidateQueries({ queryKey: courseQueryKey(variables.id) })
    },
  })
}
