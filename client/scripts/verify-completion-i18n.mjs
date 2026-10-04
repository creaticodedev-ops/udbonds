/**
 * Ensures completion.* keys match across en, fr, es.
 * Usage: node client/scripts/verify-completion-i18n.mjs
 */
import { en, fr, es } from '../src/i18n/translations.js'

const langs = { en: en.completion, fr: fr.completion, es: es.completion }
const baseKeys = Object.keys(langs.en)
let failed = false

for (const key of baseKeys) {
  for (const [lang, dict] of Object.entries(langs)) {
    if (typeof dict[key] !== 'string' || !dict[key].trim()) {
      console.error(`MISSING completion.${key} in ${lang}`)
      failed = true
    }
  }
}

for (const lang of ['fr', 'es']) {
  const extra = Object.keys(langs[lang]).filter((k) => !baseKeys.includes(k))
  if (extra.length) console.warn(`Extra keys in ${lang}:`, extra.join(', '))
}

if (failed) process.exit(1)
console.log(`OK — ${baseKeys.length} completion keys in en, fr, es`)
