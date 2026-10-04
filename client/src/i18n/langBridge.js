/**
 * Shared marketing ↔ app locale bridge.
 * Marketing supports en/fr/es/ar; owner/storefront app supports en/fr/es.
 */
export const MKT_LANG_KEY = 'kririder-mkt-lang'
export const APP_LANG_KEY = 'language'
export const LANG_CHANGE_EVENT = 'kririder:lang-change'

export const MKT_LOCALES = ['en', 'fr', 'es', 'ar']
export const APP_LOCALES = ['en', 'fr', 'es']

export const persistMktLocale = (code) => {
  if (!MKT_LOCALES.includes(code)) return
  try {
    localStorage.setItem(MKT_LANG_KEY, code)
    if (APP_LOCALES.includes(code)) {
      localStorage.setItem(APP_LANG_KEY, code)
    }
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LANG_CHANGE_EVENT, { detail: { code, source: 'mkt' } }))
  }
}

export const persistAppLocale = (code) => {
  if (!APP_LOCALES.includes(code)) return
  try {
    localStorage.setItem(APP_LANG_KEY, code)
    localStorage.setItem(MKT_LANG_KEY, code)
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LANG_CHANGE_EVENT, { detail: { code, source: 'app' } }))
  }
}

export const readPreferredMktLocale = () => {
  try {
    const mkt = localStorage.getItem(MKT_LANG_KEY)
    if (MKT_LOCALES.includes(mkt)) return mkt
    const app = localStorage.getItem(APP_LANG_KEY)
    if (MKT_LOCALES.includes(app)) return app
  } catch {
    /* ignore */
  }
  return null
}

export const readPreferredAppLocale = () => {
  try {
    const mkt = localStorage.getItem(MKT_LANG_KEY)
    if (APP_LOCALES.includes(mkt)) return mkt
    const app = localStorage.getItem(APP_LANG_KEY)
    if (APP_LOCALES.includes(app)) return app
  } catch {
    /* ignore */
  }
  return null
}
