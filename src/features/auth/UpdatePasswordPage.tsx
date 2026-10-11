import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { supabase } from '../../lib/supabase/client'
import { AuthLayout, FormError, inputClass, primaryButtonClass } from './AuthLayout'

export function UpdatePasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSubmitting(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    void navigate('/')
  }

  return (
    <AuthLayout title={t('auth.resetPassword')}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <FormError message={error} />
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
          {t('common.save')}
        </button>
      </form>
    </AuthLayout>
  )
}
