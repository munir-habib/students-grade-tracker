import { useTranslation } from 'react-i18next'

import { SUPPORTED_LOCALES } from '../lib/i18n/init'
import { supabase } from '../lib/supabase/client'
import { useAuth } from '../features/auth/AuthContext'

const LABELS: Record<string, string> = { en: 'English', hi: 'हिन्दी', pt: 'Português' }

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const { session } = useAuth()

  const handleChange = async (locale: string) => {
    await i18n.changeLanguage(locale)
    if (session) {
      await supabase.from('profiles').update({ locale_pref: locale }).eq('id', session.user.id)
    }
  }

  return (
    <select
      aria-label={t('settings.language')}
      value={i18n.language}
      onChange={(e) => void handleChange(e.target.value)}
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-sm text-[var(--color-text)]"
    >
      {SUPPORTED_LOCALES.map((locale) => (
        <option key={locale} value={locale}>
          {LABELS[locale]}
        </option>
      ))}
    </select>
  )
}
