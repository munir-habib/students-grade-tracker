import { useTranslation } from 'react-i18next'

import { supabase } from '../../lib/supabase/client'
import { secondaryButtonClass } from './AuthLayout'

export function GoogleButton() {
  const { t } = useTranslation()

  const handleClick = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  return (
    <button type="button" onClick={handleClick} className={secondaryButtonClass}>
      {t('auth.continueWithGoogle')}
    </button>
  )
}
