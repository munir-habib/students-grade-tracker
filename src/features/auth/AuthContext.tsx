import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { supabase } from '../../lib/supabase/client'
import type { Profile } from '../../lib/supabase/types'
import { useTheme } from '../../lib/theme/ThemeProvider'

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const { setTheme } = useTheme()
  const { i18n } = useTranslation()

  const loadProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) {
      setProfile(data)
      setTheme(data.theme_pref)
      if (data.locale_pref && data.locale_pref !== i18n.language) {
        void i18n.changeLanguage(data.locale_pref)
      }
      void supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', userId)
    }
  }

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      if (data.session) void loadProfile(data.session.user.id)
      setLoading(false)
    })
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (newSession) {
        void loadProfile(newSession.user.id)
      } else {
        setProfile(null)
      }
    })
    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      signOut: async () => {
        await supabase.auth.signOut()
      },
      refreshProfile: async () => {
        if (session) await loadProfile(session.user.id)
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, profile, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
