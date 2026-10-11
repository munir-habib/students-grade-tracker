import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'

import { supabase } from '../../lib/supabase/client'
import { useAuth } from './AuthContext'
import { AuthLayout, FormError, inputClass, primaryButtonClass } from './AuthLayout'
import { GoogleButton } from './GoogleButton'

export function LoginPage() {
  const { t } = useTranslation()
  const { session } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (session) navigate('/', { replace: true })
  }, [session, navigate])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)
    if (signInError) setError(t('auth.signInError'))
  }

  return (
    <AuthLayout title={t('auth.signIn')}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <FormError message={error} />
        <input
          type="email"
          required
          placeholder={t('auth.email')}
          className={inputClass}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <input
          type="password"
          required
          placeholder={t('auth.password')}
          className={inputClass}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        <div className="text-right">
          <Link to="/reset-password" className="text-xs text-[var(--color-accent)]">
            {t('auth.forgotPassword')}
          </Link>
        </div>
        <button type="submit" disabled={submitting} className={primaryButtonClass}>
          {t('auth.signIn')}
        </button>
        <GoogleButton />
        <p className="text-center text-xs text-[var(--color-text-muted)]">
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="text-[var(--color-accent)]">
            {t('auth.signUp')}
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
