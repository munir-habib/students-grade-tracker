import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useLocation } from 'react-router'

import { useAuth } from '../features/auth/AuthContext'
import { LanguageSwitcher } from './LanguageSwitcher'
import { ThemeToggle } from './ThemeToggle'
import { Watermark } from './Watermark'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-1.5 text-sm ${isActive ? 'bg-[var(--color-accent)] text-[var(--color-accent-contrast)]' : 'text-[var(--color-text)]'}`

export function AppLayout() {
  const { t } = useTranslation()
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => setMenuOpen(false), [location.pathname])

  useEffect(() => {
    if (!menuOpen) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  const navItems = [
    { to: '/', end: true, label: t('dashboard.title') },
    { to: '/courses', end: false, label: t('courses.title') },
    ...(profile?.role === 'admin' ? [{ to: '/admin', end: false, label: t('admin.title') }] : []),
    { to: '/settings', end: false, label: t('common.settings') },
  ]

  return (
    <div className="min-h-svh bg-[var(--color-bg)] text-[var(--color-text)]">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="rounded-lg border border-[var(--color-border)] p-1.5 md:hidden"
            aria-label={t('common.menu')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="whitespace-nowrap font-semibold">{t('common.appName')}</span>
        </div>
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          <LanguageSwitcher />
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-lg border border-[var(--color-border)] px-2 py-1 text-sm"
          >
            {t('common.logOut')}
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-30 md:hidden">
          <button
            type="button"
            aria-label={t('common.close')}
            className="absolute inset-0 bg-black/50"
            onClick={() => setMenuOpen(false)}
          />
          <nav className="absolute inset-y-0 left-0 flex w-64 max-w-[80vw] flex-col gap-1 border-r border-[var(--color-border)] bg-[var(--color-bg)] p-4 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-semibold">{t('common.appName')}</span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label={t('common.close')}
                className="rounded-lg p-1.5"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                  <path strokeLinecap="round" d="M6 6l12 12M18 6l-12 12" />
                </svg>
              </button>
            </div>
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
                {item.label}
              </NavLink>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-[var(--color-border)] pt-3">
              <ThemeToggle />
              <LanguageSwitcher />
              <button
                type="button"
                onClick={() => void signOut()}
                className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-left text-sm"
              >
                {t('common.logOut')}
              </button>
            </div>
          </nav>
        </div>
      )}

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
      <Watermark />
    </div>
  )
}
