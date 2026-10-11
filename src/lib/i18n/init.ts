import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import en from '../../locales/en.json'
import hi from '../../locales/hi.json'
import pt from '../../locales/pt.json'

export const SUPPORTED_LOCALES = ['en', 'hi', 'pt'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
      pt: { translation: pt },
    },
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LOCALES,
    interpolation: { escapeValue: false },
    detection: {
      // English is the spec'd default (§2) — only an explicit prior choice (this app's own
      // switcher, or a signed-in profile's locale_pref) should override it, never the browser's
      // language, so a logged-out visitor always lands on English first.
      order: ['localStorage'],
      caches: ['localStorage'],
      lookupLocalStorage: 'grade-tracker:locale',
    },
  })

export default i18n
