const STORAGE_KEY = 'kririder-mkt-lang'

export const MKT_LOCALES = [
  { code: 'en', dir: 'ltr', htmlLang: 'en', ogLocale: 'en_GB', native: 'English', short: 'EN' },
  { code: 'fr', dir: 'ltr', htmlLang: 'fr', ogLocale: 'fr_FR', native: 'Français', short: 'FR' },
  { code: 'es', dir: 'ltr', htmlLang: 'es', ogLocale: 'es_ES', native: 'Español', short: 'ES' },
  { code: 'ar', dir: 'rtl', htmlLang: 'ar', ogLocale: 'ar_SA', native: 'العربية', short: 'AR' },
]

export const MKT_LOCALE_CODES = MKT_LOCALES.map((item) => item.code)

export const getLocaleMeta = (code) => MKT_LOCALES.find((item) => item.code === code) || MKT_LOCALES[0]

export const readStoredLocale = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (MKT_LOCALE_CODES.includes(stored)) return stored
  } catch {
    /* ignore */
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language || '' : ''
  if (nav.startsWith('ar')) return 'ar'
  if (nav.startsWith('fr')) return 'fr'
  if (nav.startsWith('es')) return 'es'
  return 'en'
}

export const writeStoredLocale = (code) => {
  try {
    localStorage.setItem(STORAGE_KEY, code)
  } catch {
    /* ignore */
  }
}

export const interpolate = (value, vars = {}) =>
  Object.keys(vars).reduce((str, key) => str.replace(new RegExp(`{{${key}}}`, 'g'), String(vars[key])), value)

export const getNested = (obj, path) =>
  path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj)
