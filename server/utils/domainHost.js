import crypto from 'crypto';

/**
 * P3 host / domain helpers for public tenancy.
 * Priority at request time: verified custom domain → platform subdomain → /s/:slug → default.
 */

export const getPlatformBaseDomain = () =>
  String(process.env.PLATFORM_BASE_DOMAIN || '')
    .trim()
    .toLowerCase()
    .replace(/^\.+|\.+$/g, '');

/** Strip port and lowercase. */
export const normalizeHost = (value) => {
  let host = String(value || '')
    .trim()
    .toLowerCase()
    .split(',')[0]
    .trim();
  if (!host) return '';
  // Strip port (IPv4 / hostname)
  if (host.includes(':') && !host.startsWith('[')) {
    host = host.replace(/:\d+$/, '');
  }
  return host.replace(/\.$/, '');
};

export const normalizeCustomDomain = (value) => {
  let host = normalizeHost(value);
  host = host.replace(/^https?:\/\//, '');
  host = host.split('/')[0];
  host = host.replace(/^www\./, '');
  // Basic hostname validation
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(host)) {
    return '';
  }
  // Reject platform apex / www as a "custom" domain
  const base = getPlatformBaseDomain();
  if (base && (host === base || host === `www.${base}`)) return '';
  return host;
};

/**
 * If Host is `{slug}.{PLATFORM_BASE_DOMAIN}`, return slug.
 * Ignores apex, www, and api.* / admin.* reserved labels.
 */
export const extractSubdomainSlug = (hostInput) => {
  const host = normalizeHost(hostInput);
  const base = getPlatformBaseDomain();
  if (!host || !base) return '';
  if (host === base || host === `www.${base}`) return '';
  if (!host.endsWith(`.${base}`)) return '';
  const label = host.slice(0, -(base.length + 1));
  if (!label || label.includes('.')) return '';
  const reserved = new Set(['www', 'api', 'admin', 'superadmin', 'app', 'owner', 'static', 'cdn']);
  if (reserved.has(label)) return '';
  return label.replace(/[^a-z0-9-]/g, '').slice(0, 64);
};

export const buildSubdomainHost = (slug) => {
  const base = getPlatformBaseDomain();
  const safe = String(slug || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  if (!base || !safe) return '';
  return `${safe}.${base}`;
};

export const buildSubdomainUrl = (slug, { protocol = 'https' } = {}) => {
  const host = buildSubdomainHost(slug);
  if (!host) return '';
  return `${protocol}://${host}/`;
};

export const buildCustomDomainUrl = (domain, { protocol = 'https' } = {}) => {
  const host = normalizeCustomDomain(domain);
  if (!host) return '';
  return `${protocol}://${host}/`;
};

export const generateDomainVerifyToken = () =>
  `kri-${crypto.randomBytes(16).toString('hex')}`;

/** DNS TXT name agencies should create. */
export const domainVerifyTxtName = (domain) => {
  const host = normalizeCustomDomain(domain);
  return host ? `_kri-verify.${host}` : '';
};

export default {
  getPlatformBaseDomain,
  normalizeHost,
  normalizeCustomDomain,
  extractSubdomainSlug,
  buildSubdomainHost,
  buildSubdomainUrl,
  buildCustomDomainUrl,
  generateDomainVerifyToken,
  domainVerifyTxtName,
};
