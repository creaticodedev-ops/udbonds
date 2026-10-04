/** Public agency storefront paths + P3 host detection */

export const normalizeAgencySlug = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)

export const getPlatformBaseDomain = () =>
  String(
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PLATFORM_BASE_DOMAIN) ||
      '',
  )
    .trim()
    .toLowerCase()
    .replace(/^\.+|\.+$/g, '')

/** Build-time default storefront for platform apex (kririder.com/) in multi-agency deploys. */
export const getDefaultStorefrontSlug = () =>
  normalizeAgencySlug(import.meta.env?.VITE_DEFAULT_STOREFRONT_SLUG || '')

/** True when the browser is on the platform marketing apex (not a tenant subdomain/custom domain). */
export const isPlatformApex = (hostname = typeof window !== 'undefined' ? window.location.hostname : '') => {
  const host = String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '')
  const base = getPlatformBaseDomain()
  if (!base || !host) return false
  return host === base || host === `www.${base}`
}

export const parseStorefrontSlug = (pathname) => {
  const match = String(pathname || '').match(/^\/s\/([a-z0-9-]+)(?:\/|$)/i)
  return match ? normalizeAgencySlug(match[1]) : ''
}

const isLocalDevHost = (host) =>
  host === 'localhost' ||
  host === '127.0.0.1' ||
  host === '0.0.0.0' ||
  host === '::1' ||
  host.endsWith('.localhost')

/**
 * Detect tenant from browser Host (P3).
 * - `{slug}.{PLATFORM_BASE_DOMAIN}` → subdomain slug
 * - custom domain (not platform apex) → isCustomDomain
 * - localhost / loopback → marketing apex (not a tenant)
 */
export const detectHostTenant = (hostname = typeof window !== 'undefined' ? window.location.hostname : '') => {
  const host = String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '')
  const base = getPlatformBaseDomain()
  if (!host) return { slug: '', isCustomDomain: false, host: '', atRoot: false }

  // Local preview/dev is the marketing apex, not a tenant custom domain.
  if (isLocalDevHost(host)) {
    return { slug: '', isCustomDomain: false, host, atRoot: false }
  }

  if (base) {
    if (host === base || host === `www.${base}`) {
      return { slug: '', isCustomDomain: false, host, atRoot: false }
    }
    if (host.endsWith(`.${base}`)) {
      const label = host.slice(0, -(base.length + 1))
      const reserved = new Set(['www', 'api', 'admin', 'superadmin', 'app', 'owner', 'static', 'cdn'])
      if (label && !label.includes('.') && !reserved.has(label)) {
        const slug = normalizeAgencySlug(label)
        return { slug, isCustomDomain: false, host, atRoot: Boolean(slug) }
      }
    }
    // Host is neither apex nor subdomain → treat as custom domain
    return { slug: '', isCustomDomain: true, host, atRoot: true }
  }

  return { slug: '', isCustomDomain: false, host, atRoot: false }
}

/**
 * Resolve the active storefront slug for public API calls.
 * Priority: /s/:slug path → subdomain → ?agency= → platform-apex default env slug.
 */
export const resolveStorefrontSlug = ({
  pathname = '',
  search = '',
  hostname = typeof window !== 'undefined' ? window.location.hostname : '',
} = {}) => {
  const fromPath = parseStorefrontSlug(pathname)
  if (fromPath) return fromPath

  const hostTenant = detectHostTenant(hostname)
  if (hostTenant.slug) return hostTenant.slug

  try {
    const fromQuery = normalizeAgencySlug(new URLSearchParams(search).get('agency') || '')
    if (fromQuery) return fromQuery
  } catch {
    // ignore malformed search
  }

  // Platform apex marketing homepage is the RSZ CAR SaaS site.
  // Tenant catalogs live at /s/:slug, {slug}.kririder.com, or a custom domain.
  return ''
}

/** Build a path under the current agency storefront, or a root path when no slug / host-root. */
export const storefrontPath = (slug, path = '/', { atRoot = false } = {}) => {
  const clean =
    !path || path === '/'
      ? ''
      : path.startsWith('/')
        ? path
        : `/${path}`
  if (atRoot) return clean || '/'
  const safeSlug = normalizeAgencySlug(slug)
  if (!safeSlug) return clean || '/'
  return `/s/${safeSlug}${clean}`
}

export const buildAbsoluteStorefrontUrl = (slug, origin, opts = {}) => {
  const base = String(origin || (typeof window !== 'undefined' ? window.location.origin : ''))
    .replace(/\/$/, '')
  const path = storefrontPath(slug, '/', opts)
  return path === '/' ? `${base}/` : `${base}${path}`
}

export const isStorefrontHomePath = (pathname) => {
  const p = String(pathname || '')
  return p === '/' || /^\/s\/[a-z0-9-]+\/?$/i.test(p)
}

export default {
  normalizeAgencySlug,
  parseStorefrontSlug,
  resolveStorefrontSlug,
  storefrontPath,
  buildAbsoluteStorefrontUrl,
  isStorefrontHomePath,
  detectHostTenant,
  getPlatformBaseDomain,
  getDefaultStorefrontSlug,
  isPlatformApex,
}
