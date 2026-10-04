import { buildSubdomainUrl, buildCustomDomainUrl } from '../utils/domainHost.js';

/** First origin from CLIENT_URL (comma-separated allowlist). */
export const getClientOrigin = () =>
  String(process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')[0]
    .trim()
    .replace(/\/$/, '');

/**
 * Owner workspace is the platform `/owner` app, scoped by JWT + agencyId.
 * Tenant slug/subdomain is the public storefront — not the owner dashboard.
 */
export const buildOwnerDashboardUrl = () => `${getClientOrigin()}/owner`;

export const buildOwnerLoginUrl = () => getClientOrigin();

export const buildAgencyAccessUrls = (agency = {}) => {
  const dashboardUrl = buildOwnerDashboardUrl();
  const loginUrl = buildOwnerLoginUrl();
  const slug = String(agency.slug || '').trim();
  const protocol = String(process.env.STOREFRONT_URL_PROTOCOL || 'https').replace(':', '') || 'https';
  const custom =
    agency.customDomain && ['verified', 'active'].includes(agency.customDomainStatus)
      ? buildCustomDomainUrl(agency.customDomain, { protocol })
      : '';
  const subdomain =
    slug && agency.subdomainEnabled !== false ? buildSubdomainUrl(slug, { protocol }) : '';
  const pathStorefront = slug ? `${getClientOrigin()}/s/${slug}` : '';
  return {
    dashboardUrl,
    loginUrl,
    storefrontUrl: custom || subdomain || pathStorefront,
  };
};

export default {
  getClientOrigin,
  buildOwnerDashboardUrl,
  buildOwnerLoginUrl,
  buildAgencyAccessUrls,
};
