import { useTranslation } from 'react-i18next'

import { useAuth } from '../auth/AuthContext'
import { supabase } from '../../lib/supabase/client'
import { LanguageSwitcher } from '../../app/LanguageSwitcher'
import { ThemeToggle } from '../../app/ThemeToggle'

export function SettingsPage() {
  const { t } = useTranslation()
  const { profile, refreshProfile } = useAuth()

  const handleGradeReplacementChange = async (checked: boolean) => {
    if (!profile) return
    await supabase.from('profiles').update({ only_last_attempt_counts: checked }).eq('id', profile.id)
    await refreshProfile()
  }

  return (
    <div className="flex max-w-md flex-col gap-6">
      <h1 className="text-lg font-semibold">{t('common.settings')}</h1>

      <div className="flex items-center justify-between">
        <span className="text-sm">{t('settings.theme')}</span>
        <ThemeToggle />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm">{t('settings.language')}</span>
        <LanguageSwitcher />
      </div>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1"
          checked={profile?.only_last_attempt_counts ?? true}
          onChange={(e) => void handleGradeReplacementChange(e.target.checked)}
        />
        <span>
          <span className="block text-sm">{t('settings.gradeReplacement')}</span>
          <span className="block text-xs text-[var(--color-text-muted)]">{t('settings.gradeReplacementHint')}</span>
        </span>
      </label>
    </div>
  )
}
