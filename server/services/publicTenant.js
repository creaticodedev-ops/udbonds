import mongoose from 'mongoose';
import Agency from '../models/Agency.js';
import User from '../models/User.js';
import {
  normalizeHost,
  normalizeCustomDomain,
  extractSubdomainSlug,
  buildSubdomainUrl,
  buildCustomDomainUrl,
  getPlatformBaseDomain,
} from '../utils/domainHost.js';

/**
 * Public-tenant resolution — returns exactly one Agency for the storefront.
 * Never merges fleets across agencies.
 *
 * P3 resolution priority:
 * 1. Verified/active custom domain (Host)
 * 2. Platform subdomain `{slug}.{PLATFORM_BASE_DOMAIN}` (Host)
 * 3. Explicit slug (query / X-Agency-Slug / body / /s/:slug client header)
 * 4. Default `/` rules (PUBLIC_AGENCY_ID → … → fail closed)
 *
 * /s/:agencySlug remains supported forever (P1).
 */

export class PublicTenantError extends Error {
  constructor(
    message = 'Public catalog unavailable: with multiple agencies set PUBLIC_AGENCY_ID (or PUBLIC_OWNER_ID); single-agency deploys resolve automatically',
  ) {
    super(message);
    this.name = 'PublicTenantError';
    this.status = 503;
    this.code = 'PUBLIC_TENANT_UNRESOLVED';
  }
}

export class PublicAgencyNotFoundError extends Error {
  constructor(message = 'Agency storefront not found') {
    super(message);
    this.name = 'PublicAgencyNotFoundError';
    this.status = 404;
    this.code = 'PUBLIC_AGENCY_NOT_FOUND';
  }
}

const cache = new Map();
const CACHE_MS = 30_000;
const DEFAULT_KEY = '__default__';

export const clearPublicTenantCache = () => {
  cache.clear();
};

const cacheGet = (key) => {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at >= CACHE_MS) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
};

const cacheSet = (key, value) => {
  cache.set(key, { value, at: Date.now() });
};

const toPublicAgency = (agency, extras = {}) => ({
  agencyId: agency._id,
  legacyOwnerId: agency.legacyOwnerId || agency.primaryOwnerUserId,
  primaryOwnerUserId: agency.primaryOwnerUserId,
  slug: agency.slug,
  name: agency.name,
  customDomain: agency.customDomain || '',
  customDomainStatus: agency.customDomainStatus || 'none',
  subdomainEnabled: agency.subdomainEnabled !== false,
  ...extras,
});

export const normalizeAgencySlug = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

/** Read storefront slug from query, header, or body (POST booking flows). */
export const extractPublicAgencySlug = (req) => {
  if (!req) return '';
  const fromQuery = normalizeAgencySlug(req.query?.agency || req.query?.slug);
  if (fromQuery) return fromQuery;
  const header = req.headers?.['x-agency-slug'] || req.headers?.['X-Agency-Slug'];
  const fromHeader = normalizeAgencySlug(header);
  if (fromHeader) return fromHeader;
  return normalizeAgencySlug(req.body?.agencySlug || req.body?.agency);
};

/** Prefer X-Agency-Host (SPA on custom domain/subdomain) → X-Forwarded-Host → Host. */
export const extractRequestHost = (req) => {
  if (!req) return '';
  const agencyHost = req.headers?.['x-agency-host'] || req.headers?.['X-Agency-Host'];
  if (agencyHost) return normalizeHost(agencyHost);
  const forwarded = req.headers?.['x-forwarded-host'];
  if (forwarded) return normalizeHost(String(forwarded).split(',')[0]);
  return normalizeHost(req.headers?.host || req.hostname);
};

const resolveBySlug = async (slug) => {
  const key = `slug:${slug}`;
  const cached = cacheGet(key);
  if (cached !== undefined) {
    if (cached === null) throw new PublicAgencyNotFoundError();
    return cached;
  }

  const agency = await Agency.findOne({ slug, status: 'active' })
    .select(
      '_id legacyOwnerId primaryOwnerUserId slug name customDomain customDomainStatus subdomainEnabled',
    )
    .lean();
  if (!agency) {
    cacheSet(key, null);
    throw new PublicAgencyNotFoundError(`No active storefront for agency "${slug}"`);
  }
  const resolved = toPublicAgency(agency);
  cacheSet(key, resolved);
  return resolved;
};

const resolveByCustomDomain = async (host) => {
  const domain = normalizeCustomDomain(host);
  if (!domain) return null;
  const key = `domain:${domain}`;
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;

  const agency = await Agency.findOne({
    status: 'active',
    customDomainStatus: { $in: ['verified', 'active'] },
    customDomain: { $in: [domain, `www.${domain}`] },
  })
    .select(
      '_id legacyOwnerId primaryOwnerUserId slug name customDomain customDomainStatus subdomainEnabled',
    )
    .lean();

  if (!agency) {
    cacheSet(key, null);
    return null;
  }
  const resolved = toPublicAgency(agency, { resolvedVia: 'custom_domain' });
  cacheSet(key, resolved);
  return resolved;
};

const resolveBySubdomainHost = async (host) => {
  const slug = extractSubdomainSlug(host);
  if (!slug) return null;
  const key = `sub:${slug}`;
  const cached = cacheGet(key);
  if (cached !== undefined) {
    if (cached === null) return null;
    return cached;
  }

  const agency = await Agency.findOne({
    slug,
    status: 'active',
    subdomainEnabled: { $ne: false },
  })
    .select(
      '_id legacyOwnerId primaryOwnerUserId slug name customDomain customDomainStatus subdomainEnabled',
    )
    .lean();
  if (!agency) {
    cacheSet(key, null);
    return null;
  }
  const resolved = toPublicAgency(agency, { resolvedVia: 'subdomain' });
  cacheSet(key, resolved);
  return resolved;
};

const resolveDefaultAgency = async () => {
  const cached = cacheGet(DEFAULT_KEY);
  if (cached !== undefined) {
    if (cached === null) throw new PublicTenantError();
    return cached;
  }

  const fromAgencyEnv = process.env.PUBLIC_AGENCY_ID?.trim();
  if (fromAgencyEnv && mongoose.isValidObjectId(fromAgencyEnv)) {
    const agency = await Agency.findById(fromAgencyEnv)
      .select(
        '_id legacyOwnerId primaryOwnerUserId slug name status customDomain customDomainStatus subdomainEnabled',
      )
      .lean();
    if (agency && agency.status === 'active') {
      const resolved = toPublicAgency(agency);
      cacheSet(DEFAULT_KEY, resolved);
      return resolved;
    }
  }

  const fromOwnerEnv = process.env.PUBLIC_OWNER_ID?.trim();
  if (fromOwnerEnv && mongoose.isValidObjectId(fromOwnerEnv)) {
    let agency = await Agency.findOne({ legacyOwnerId: fromOwnerEnv })
      .select(
        '_id legacyOwnerId primaryOwnerUserId slug name status customDomain customDomainStatus subdomainEnabled',
      )
      .lean();
    if (!agency) {
      const owner = await User.findOne({ _id: fromOwnerEnv, role: 'owner' })
        .select('_id agencyId')
        .lean();
      if (owner?.agencyId) {
        agency = await Agency.findById(owner.agencyId)
          .select(
            '_id legacyOwnerId primaryOwnerUserId slug name status customDomain customDomainStatus subdomainEnabled',
          )
          .lean();
      }
    }
    if (agency && agency.status === 'active') {
      const resolved = toPublicAgency(agency);
      cacheSet(DEFAULT_KEY, resolved);
      return resolved;
    }
  }

  const flagged = await Agency.find({ isPublicStorefront: true, status: 'active' })
    .select(
      '_id legacyOwnerId primaryOwnerUserId slug name customDomain customDomainStatus subdomainEnabled',
    )
    .lean();
  if (flagged.length === 1) {
    const resolved = toPublicAgency(flagged[0]);
    cacheSet(DEFAULT_KEY, resolved);
    return resolved;
  }

  const active = await Agency.find({ status: 'active' })
    .select(
      '_id legacyOwnerId primaryOwnerUserId slug name customDomain customDomainStatus subdomainEnabled',
    )
    .lean();
  if (active.length === 1) {
    const resolved = toPublicAgency(active[0]);
    cacheSet(DEFAULT_KEY, resolved);
    return resolved;
  }

  if (active.length === 0) {
    const owners = await User.find({ role: 'owner', accountStatus: 'active' })
      .select('_id')
      .lean();
    if (owners.length === 1) {
      const resolved = {
        agencyId: null,
        legacyOwnerId: owners[0]._id,
        primaryOwnerUserId: owners[0]._id,
        slug: null,
        name: null,
        ownerOnlyFallback: true,
      };
      cacheSet(DEFAULT_KEY, resolved);
      return resolved;
    }
  }

  cacheSet(DEFAULT_KEY, null);
  if (active.length > 1) {
    console.error(
      `[publicTenant] ${active.length} active agencies — automatic resolution disabled. ` +
        'Set PUBLIC_AGENCY_ID to the storefront agency (PUBLIC_OWNER_ID still accepted as legacy).',
    );
  } else {
    console.error(
      `[publicTenant] Cannot resolve public agency: activeAgencies=${active.length}.`,
    );
  }
  throw new PublicTenantError();
};

/**
 * Resolve from an Express request (Host + slug headers).
 */
export const resolvePublicAgencyFromRequest = async (req) => {
  const host = extractRequestHost(req);

  if (host) {
    const byDomain = await resolveByCustomDomain(host);
    if (byDomain) return byDomain;

    const bySub = await resolveBySubdomainHost(host);
    if (bySub) return bySub;
  }

  const slug = extractPublicAgencySlug(req);
  if (slug) return resolveBySlug(slug);

  return resolveDefaultAgency();
};

/**
 * @param {string|{ slug?: string, host?: string, req?: object }|undefined} slugOrOpts
 */
export const resolvePublicAgency = async (slugOrOpts) => {
  if (slugOrOpts?.req) {
    return resolvePublicAgencyFromRequest(slugOrOpts.req);
  }
  if (slugOrOpts?.host) {
    const byDomain = await resolveByCustomDomain(slugOrOpts.host);
    if (byDomain) return byDomain;
    const bySub = await resolveBySubdomainHost(slugOrOpts.host);
    if (bySub) return bySub;
  }
  const slug =
    typeof slugOrOpts === 'string'
      ? normalizeAgencySlug(slugOrOpts)
      : normalizeAgencySlug(slugOrOpts?.slug);
  if (slug) return resolveBySlug(slug);
  return resolveDefaultAgency();
};

export const resolvePublicAgencyId = async (slugOrOpts) => {
  const agency = await resolvePublicAgency(slugOrOpts);
  if (agency.agencyId) return String(agency.agencyId);
  if (agency.ownerOnlyFallback && agency.legacyOwnerId) return String(agency.legacyOwnerId);
  throw new PublicTenantError();
};

export const resolvePublicOwnerId = async (slugOrOpts) => {
  const agency = await resolvePublicAgency(slugOrOpts);
  return String(agency.legacyOwnerId || agency.primaryOwnerUserId);
};

/**
 * Express helper. Accepts (req, res) or legacy (res).
 * Uses Host-aware resolution when req is provided.
 */
export const requirePublicAgency = async (reqOrRes, maybeRes) => {
  const hasReq = Boolean(maybeRes);
  const req = hasReq ? reqOrRes : null;
  const res = hasReq ? maybeRes : reqOrRes;

  try {
    if (req) return await resolvePublicAgencyFromRequest(req);
    const slug = extractPublicAgencySlug(req);
    return await resolvePublicAgency(slug ? { slug } : undefined);
  } catch (error) {
    if (error instanceof PublicTenantError || error instanceof PublicAgencyNotFoundError) {
      res.status(error.status).json({
        success: false,
        message: error.message,
        code: error.code,
      });
      return null;
    }
    throw error;
  }
};

/** @deprecated use requirePublicAgency */
export const requirePublicOwnerId = async (reqOrRes, maybeRes) => {
  const agency = await requirePublicAgency(reqOrRes, maybeRes);
  if (!agency) return null;
  return String(agency.legacyOwnerId || agency.primaryOwnerUserId);
};

export const buildStorefrontPath = (slug) => {
  const safe = normalizeAgencySlug(slug);
  return safe ? `/s/${safe}` : '/';
};

/**
 * Prefer custom domain (active/verified) → platform subdomain → /s/:slug path URL.
 */
export const buildStorefrontUrl = (slug, agencyDoc = null) => {
  const protocol =
    String(process.env.STOREFRONT_URL_PROTOCOL || 'https').replace(':', '') || 'https';

  if (agencyDoc) {
    const status = agencyDoc.customDomainStatus || '';
    if (
      agencyDoc.customDomain &&
      (status === 'verified' || status === 'active')
    ) {
      const custom = buildCustomDomainUrl(agencyDoc.customDomain, { protocol });
      if (custom) return custom;
    }
    if (agencyDoc.subdomainEnabled !== false) {
      const sub = buildSubdomainUrl(agencyDoc.slug || slug, { protocol });
      if (sub) return sub;
    }
  } else if (getPlatformBaseDomain() && slug) {
    const sub = buildSubdomainUrl(slug, { protocol });
    if (sub) return sub;
  }

  const base = (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')[0]
    .trim()
    .replace(/\/$/, '');
  const path = buildStorefrontPath(slug);
  return path === '/' ? `${base}/` : `${base}${path}`;
};

export default {
  resolvePublicAgency,
  resolvePublicAgencyFromRequest,
  resolvePublicAgencyId,
  resolvePublicOwnerId,
  requirePublicAgency,
  requirePublicOwnerId,
  extractPublicAgencySlug,
  extractRequestHost,
  normalizeAgencySlug,
  buildStorefrontPath,
  buildStorefrontUrl,
  clearPublicTenantCache,
  PublicTenantError,
  PublicAgencyNotFoundError,
};
