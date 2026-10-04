import {
  LANG_CHANGE_EVENT,
  persistMktLocale,
  readPreferredMktLocale,
} from '../../i18n/langBridge'
import { MKT_LOCALE_CODES, getLocaleMeta, interpolate, getNested } from './locales'

export { MKT_LOCALE_CODES, getLocaleMeta, interpolate, getNested }

export const readStoredLocale = () => {
  const preferred = readPreferredMktLocale()
  if (preferred && MKT_LOCALE_CODES.includes(preferred)) return preferred
  const nav = typeof navigator !== 'undefined' ? navigator.language || '' : ''
  if (nav.startsWith('ar')) return 'ar'
  if (nav.startsWith('fr')) return 'fr'
  if (nav.startsWith('es')) return 'es'
  return 'en'
}

export const writeStoredLocale = (code) => {
  persistMktLocale(code)
}

export { LANG_CHANGE_EVENT }
