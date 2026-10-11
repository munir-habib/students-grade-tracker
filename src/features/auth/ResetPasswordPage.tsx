import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { supabase } from '../../lib/supabase/client'
import { AuthLayout, FormError, inputClass, primaryButtonClass } from './AuthLayout'

export function ResetPasswordPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    })
    setSubmitting(false)
    if (resetError) {
      setError(resetError.message)
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <AuthLayout title={t('auth.resetPassword')}>
        <p className="text-center text-sm text-[var(--color-text)]">{t('auth.resetPasswordInstructions')}</p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title={t('auth.resetPassword')}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <FormError message={error} />
        <p className="text-sm text-[var(--color-text-muted)]">{t('auth.resetPasswordInstructions')}</p>
        <input
          type="email"
          required
          placeholder={t('auth.email')}
          className={inputClass}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <button type="submit" disabled={submitting} className={primaryButtonClass}>
          {t('auth.sendResetLink')}
        </button>
        <p className="text-center text-xs text-[var(--color-text-muted)]">
          <Link to="/login" className="text-[var(--color-accent)]">
            {t('common.back')}
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
