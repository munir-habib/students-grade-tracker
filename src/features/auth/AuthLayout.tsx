import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { LanguageSwitcher } from '../../app/LanguageSwitcher'
import { Watermark } from '../../app/Watermark'

export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-[var(--color-bg)] px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
        <div className="mb-2 flex justify-end">
          <LanguageSwitcher />
        </div>
        <h1 className="mb-1 text-center text-lg font-semibold text-[var(--color-text)]">{t('common.appName')}</h1>
        <h2 className="mb-6 text-center text-sm text-[var(--color-text-muted)]">{title}</h2>
        {children}
      </div>
      <Watermark />
    </div>
  )
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return <p className="mb-3 rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">{message}</p>
}

export const inputClass =
  'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]'

export const primaryButtonClass =
  'w-full rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-medium text-[var(--color-accent-contrast)] disabled:opacity-60'

export const secondaryButtonClass =
  'w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text)] disabled:opacity-60'
