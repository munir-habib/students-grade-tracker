export type CalcMode = 'points' | 'category_percentage'
export type CourseStatus = 'in_progress' | 'completed' | 'failed_retaking'
export type AssessmentStatus = 'planned' | 'pending' | 'completed'
export type ThemePref = 'system' | 'light' | 'dark'
export type Role = 'student' | 'admin'

// Plain `type` aliases (not `interface`) so these structurally satisfy the
// `Record<string, unknown>`-style constraints the Supabase client's generics require.

export type Profile = {
  id: string
  name: string
  role: Role
  theme_pref: ThemePref
  locale_pref: string
  only_last_attempt_counts: boolean
  created_at: string
  last_seen_at: string
}

export type Term = {
  id: string
  user_id: string
  name: string
  starts_on: string | null
  ends_on: string | null
  sort_order: number
}

export type GradeScale = {
  id: string
  user_id: string | null
  name: string
}

export type GradeScaleBand = {
  id: string
  scale_id: string
  min_pct: number
  letter: string
  gpa_points: number
}

export type Course = {
  id: string
  user_id: string
  term_id: string
  name: string
  credits: number
  calc_mode: CalcMode
  status: CourseStatus
  retake_of_course_id: string | null
  grade_scale_id: string | null
}

export type Category = {
  id: string
  course_id: string
  name: string
  weight_pct: number | null
  drop_lowest_count: number
}

export type Assessment = {
  id: string
  category_id: string
  name: string
  date: string | null
  status: AssessmentStatus
  points_possible_syllabus: number | null
  points_possible_actual: number | null
  points_earned: number | null
  percent_direct: number | null
  comment: string | null
}

export type AdminAccountRow = {
  id: string
  name: string
  email: string
  created_at: string
  last_seen_at: string
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Partial<Profile> & { id: string }
        Update: Partial<Profile>
        Relationships: []
      }
      terms: { Row: Term; Insert: Omit<Term, 'id'> & { id?: string }; Update: Partial<Term>; Relationships: [] }
      grade_scales: {
        Row: GradeScale
        Insert: Omit<GradeScale, 'id'> & { id?: string }
        Update: Partial<GradeScale>
        Relationships: []
      }
      grade_scale_bands: {
        Row: GradeScaleBand
        Insert: Omit<GradeScaleBand, 'id'> & { id?: string }
        Update: Partial<GradeScaleBand>
        Relationships: []
      }
      courses: {
        Row: Course
        Insert: Omit<Course, 'id'> & { id?: string }
        Update: Partial<Course>
        Relationships: []
      }
      categories: {
        Row: Category
        Insert: Omit<Category, 'id'> & { id?: string }
        Update: Partial<Category>
        Relationships: []
      }
      assessments: {
        Row: Assessment
        Insert: Omit<Assessment, 'id'> & { id?: string }
        Update: Partial<Assessment>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      admin_account_list: { Args: Record<string, never>; Returns: AdminAccountRow[] }
    }
  }
}
