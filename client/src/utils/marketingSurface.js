/** Paths that belong to the RSZ CAR SaaS marketing site (not a tenant storefront). */
export const MARKETING_PATHS = new Set(['/', '/contact', '/privacy', '/terms', '/about', '/signup'])

export const isMarketingPath = (pathname = '') => {
  const path = String(pathname || '').split('?')[0].replace(/\/+$/, '') || '/'
  return MARKETING_PATHS.has(path)
}

/**
 * Marketing chrome + homepage (not rental catalog).
 * Tenant hosts (subdomain / custom domain) stay on their storefront at `/`.
 */
export const isMarketingSurface = (pathname, hostTenant) => {
  if (hostTenant?.atRoot) return false
  if (String(pathname || '').startsWith('/s/')) return false
  return isMarketingPath(pathname)
}

export default { MARKETING_PATHS, isMarketingPath, isMarketingSurface }
