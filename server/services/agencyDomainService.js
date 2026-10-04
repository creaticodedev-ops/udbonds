import dns from 'dns/promises';
import Agency from '../models/Agency.js';
import {
  normalizeCustomDomain,
  generateDomainVerifyToken,
  domainVerifyTxtName,
  buildSubdomainUrl,
  buildCustomDomainUrl,
  getPlatformBaseDomain,
} from '../utils/domainHost.js';
import {
  buildStorefrontPath,
  buildStorefrontUrl,
  clearPublicTenantCache,
} from '../services/publicTenant.js';

const dnsLookupEnabled = () =>
  String(process.env.DOMAIN_DNS_VERIFY || 'true').toLowerCase() !== 'false';

const allowTestForce = () =>
  String(process.env.DOMAIN_ALLOW_TEST_VERIFY || '').toLowerCase() === 'true' ||
  process.env.NODE_ENV === 'test';

export const serializeDomainState = (agency) => {
  const domain = agency.customDomain || '';
  const status = agency.customDomainStatus || 'none';
  const slug = agency.slug || '';
  const protocol =
    String(process.env.STOREFRONT_URL_PROTOCOL || 'https').replace(':', '') || 'https';
  const subdomainUrl = buildSubdomainUrl(slug, { protocol });
  const customUrl =
    domain && (status === 'verified' || status === 'active')
      ? buildCustomDomainUrl(domain, { protocol })
      : '';
  const pathUrl = buildStorefrontUrl(slug); // may prefer sub/custom if agency passed — use path fallback
  const slugPathUrl = (() => {
    const base = (process.env.CLIENT_URL || 'http://localhost:5173')
      .split(',')[0]
      .trim()
      .replace(/\/$/, '');
    const path = buildStorefrontPath(slug);
    return path === '/' ? `${base}/` : `${base}${path}`;
  })();

  return {
    platformBaseDomain: getPlatformBaseDomain() || '',
    subdomainEnabled: agency.subdomainEnabled !== false,
    subdomainHost: subdomainUrl ? subdomainUrl.replace(/^https?:\/\//, '').replace(/\/$/, '') : '',
    subdomainUrl: subdomainUrl || '',
    customDomain: domain,
    customDomainStatus: status,
    customDomainVerifiedAt: agency.customDomainVerifiedAt || null,
    customDomainUrl: customUrl,
    verifyToken: agency.customDomainVerifyToken || '',
    verifyTxtName: domain ? domainVerifyTxtName(domain) : '',
    verifyTxtValue: agency.customDomainVerifyToken || '',
    dnsInstructions: domain
      ? {
          cname: {
            host: domain,
            target: getPlatformBaseDomain()
              ? `sites.${getPlatformBaseDomain()}`
              : 'your-platform-host',
            note: 'Point your domain (or www) with a CNAME to the platform sites host. Exact target depends on your DNS/CDN setup.',
          },
          txt: {
            host: domainVerifyTxtName(domain),
            value: agency.customDomainVerifyToken || '',
            note: 'Create this TXT record, then click Verify. Or ask Super Admin to verify after DNS is ready.',
          },
        }
      : null,
    storefrontUrl: buildStorefrontUrl(slug, agency),
    slugStorefrontUrl: slugPathUrl,
    slugStorefrontPath: buildStorefrontPath(slug),
  };
};

const assertDomainAvailable = async (domain, excludeAgencyId) => {
  const clash = await Agency.findOne({
    customDomain: { $in: [domain, `www.${domain}`] },
    customDomainStatus: { $in: ['pending', 'verified', 'active'] },
    ...(excludeAgencyId ? { _id: { $ne: excludeAgencyId } } : {}),
  })
    .select('_id slug')
    .lean();
  if (clash) {
    const err = new Error('This domain is already claimed by another agency');
    err.status = 409;
    err.code = 'DOMAIN_IN_USE';
    throw err;
  }
};

export const setAgencyCustomDomain = async (agencyId, rawDomain) => {
  const agency = await Agency.findById(agencyId);
  if (!agency) {
    const err = new Error('Agency not found');
    err.status = 404;
    throw err;
  }
  const domain = normalizeCustomDomain(rawDomain);
  if (!domain) {
    const err = new Error('Invalid domain. Use a hostname like rentals.example.com (no http://)');
    err.status = 400;
    err.code = 'INVALID_DOMAIN';
    throw err;
  }

  await assertDomainAvailable(domain, agency._id);

  agency.customDomain = domain;
  agency.customDomainStatus = 'pending';
  agency.customDomainVerifyToken = generateDomainVerifyToken();
  agency.customDomainVerifiedAt = null;
  await agency.save();
  clearPublicTenantCache();
  return agency;
};

export const clearAgencyCustomDomain = async (agencyId) => {
  const agency = await Agency.findById(agencyId);
  if (!agency) {
    const err = new Error('Agency not found');
    err.status = 404;
    throw err;
  }
  agency.customDomain = '';
  agency.customDomainStatus = 'none';
  agency.customDomainVerifyToken = '';
  agency.customDomainVerifiedAt = null;
  await agency.save();
  clearPublicTenantCache();
  return agency;
};

export const setSubdomainEnabled = async (agencyId, enabled) => {
  const agency = await Agency.findById(agencyId);
  if (!agency) {
    const err = new Error('Agency not found');
    err.status = 404;
    throw err;
  }
  agency.subdomainEnabled = Boolean(enabled);
  await agency.save();
  clearPublicTenantCache();
  return agency;
};

const txtRecordsContainToken = async (domain, token) => {
  if (!token) return false;
  const names = [domainVerifyTxtName(domain), domain, `www.${domain}`];
  for (const name of names) {
    try {
      const records = await dns.resolveTxt(name);
      const flat = records.flat().map((r) => String(r).trim());
      if (flat.some((r) => r === token || r.includes(token))) return true;
    } catch {
      /* NXDOMAIN / no TXT — try next */
    }
  }
  return false;
};

/**
 * Verify custom domain DNS TXT (or force in test / Super Admin).
 */
export const verifyAgencyCustomDomain = async (
  agencyId,
  { force = false } = {},
) => {
  const agency = await Agency.findById(agencyId);
  if (!agency) {
    const err = new Error('Agency not found');
    err.status = 404;
    throw err;
  }
  if (!agency.customDomain || agency.customDomainStatus === 'none') {
    const err = new Error('No custom domain configured');
    err.status = 400;
    err.code = 'NO_DOMAIN';
    throw err;
  }

  let ok = false;
  if (force && (allowTestForce() || force === 'superadmin')) {
    ok = true;
  } else if (!dnsLookupEnabled()) {
    ok = allowTestForce();
  } else {
    ok = await txtRecordsContainToken(agency.customDomain, agency.customDomainVerifyToken);
  }

  if (!ok) {
    agency.customDomainStatus = 'failed';
    await agency.save();
    clearPublicTenantCache();
    const err = new Error(
      'DNS TXT verification failed. Add the verify TXT record and try again.',
    );
    err.status = 400;
    err.code = 'DNS_VERIFY_FAILED';
    throw err;
  }

  agency.customDomainStatus = 'active';
  agency.customDomainVerifiedAt = new Date();
  await agency.save();
  clearPublicTenantCache();
  return agency;
};

export default {
  serializeDomainState,
  setAgencyCustomDomain,
  clearAgencyCustomDomain,
  setSubdomainEnabled,
  verifyAgencyCustomDomain,
};
