import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { supabase } from '../../lib/supabase/client'

// Admins can only ever see this one RPC's worth of data about other accounts — name/email/
// registered/last-seen — enforced by Postgres RLS + a SECURITY DEFINER function, not just this
// page choosing not to query further. There is intentionally no join to courses/categories/etc.
export function AdminAccountsPage() {
  const { t, i18n } = useTranslation()

  const { data, isPending, isError } = useQuery({
    queryKey: ['admin-account-list'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_account_list')
      if (error) throw error
      return data
    },
  })

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">{t('admin.title')}</h1>

      {isPending && <p className="text-sm text-[var(--color-text-muted)]">{t('common.loading')}</p>}
      {isError && <p className="text-sm text-[var(--color-danger)]">{t('common.loadError')}</p>}
      {!isPending && !isError && data?.length === 0 && (
        <p className="text-sm text-[var(--color-text-muted)]">{t('admin.empty')}</p>
      )}

      {!isPending && !isError && data && data.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="bg-[var(--color-surface)] text-[var(--color-text-muted)]">
              <tr>
                <th className="px-3 py-2 font-medium">{t('admin.name')}</th>
                <th className="px-3 py-2 font-medium">{t('admin.email')}</th>
                <th className="px-3 py-2 font-medium">{t('admin.registeredOn')}</th>
                <th className="px-3 py-2 font-medium">{t('admin.lastSeen')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((account) => (
                <tr key={account.id} className="border-t border-[var(--color-border)]">
                  <td className="px-3 py-2">{account.name}</td>
                  <td className="px-3 py-2">{account.email}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(account.created_at)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(account.last_seen_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
