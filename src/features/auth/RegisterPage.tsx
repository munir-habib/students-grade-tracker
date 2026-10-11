import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { supabase } from '../../lib/supabase/client'
import { AuthLayout, FormError, inputClass, primaryButtonClass } from './AuthLayout'
import { GoogleButton } from './GoogleButton'

export function RegisterPage() {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })
    setSubmitting(false)
    if (signUpError) {
      setError(t('auth.signUpError'))
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <AuthLayout title={t('auth.signUp')}>
        <p className="text-center text-sm text-[var(--color-text)]">{t('auth.resetPasswordInstructions')}</p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title={t('auth.signUp')}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <FormError message={error} />
        <input
          type="text"
          required
          placeholder={t('auth.name')}
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
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
          minLength={8}
          placeholder={t('auth.password')}
          className={inputClass}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <button type="submit" disabled={submitting} className={primaryButtonClass}>
          {t('auth.signUp')}
        </button>
        <GoogleButton />
        <p className="text-center text-xs text-[var(--color-text-muted)]">
          {t('auth.haveAccount')}{' '}
          <Link to="/login" className="text-[var(--color-accent)]">
            {t('auth.signIn')}
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
