import { useTranslation } from 'react-i18next'

import { useTheme, type ThemePref } from '../lib/theme/ThemeProvider'

const OPTIONS: ThemePref[] = ['system', 'light', 'dark']

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const { t } = useTranslation()

  const labels: Record<ThemePref, string> = {
    system: t('settings.themeSystem'),
    light: t('settings.themeLight'),
    dark: t('settings.themeDark'),
  }

  return (
    <select
      aria-label={t('settings.theme')}
      value={theme}
      onChange={(e) => setTheme(e.target.value as ThemePref)}
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-sm text-[var(--color-text)]"
    >
      {OPTIONS.map((option) => (
        <option key={option} value={option}>
          {labels[option]}
        </option>
      ))}
    </select>
  )
}
