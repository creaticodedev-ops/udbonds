/**
 * Central API origin for every Axios client.
 * Paths in the app already start with `/api/...`, so the env value must be
 * the origin only (e.g. https://api.kririder.com) — never include `/api`.
 *
 * Canonical env: VITE_API_URL
 * Legacy alias:  VITE_BASE_URL (still accepted so older deploys keep working)
 */
export const normalizeApiBaseUrl = (raw) => {
  let base = String(raw ?? '').trim()
  if (!base) return ''
  base = base.replace(/\/+$/, '')
  if (base.endsWith('/api')) {
    base = base.slice(0, -4).replace(/\/+$/, '')
  }
  return base
}

const readEnvApiUrl = () => {
  const fromCanonical = import.meta.env.VITE_API_URL
  const fromLegacy = import.meta.env.VITE_BASE_URL
  return fromCanonical || fromLegacy || ''
}

/**
 * Dev (no env): empty base → Vite proxies `/api` to the local backend.
 * Prod: requires VITE_API_URL (or legacy VITE_BASE_URL). Never falls back to
 * window.location.origin — that sent traffic to the SPA host (kririder.com/api).
 */
export const resolveApiBaseUrl = () => {
  const envUrl = readEnvApiUrl()
  if (envUrl) return normalizeApiBaseUrl(envUrl)

  if (import.meta.env.DEV) return ''

  if (typeof console !== 'undefined') {
    console.error(
      '[apiBase] Missing VITE_API_URL. Set it to the API origin only ' +
        '(e.g. https://api.kririder.com) — do not append /api.',
    )
  }
  return ''
}
