/**
 * Platform identity only — Super Admin, trial/license, system messages.
 * Never use this for agency storefronts, PDFs, emails, or WhatsApp to customers.
 */
export const PLATFORM_NAME =
  String(process.env.PLATFORM_NAME || process.env.BRAND_NAME || 'RSZ CAR').trim() ||
  'RSZ CAR';

export const PLATFORM_SUPPORT_EMAIL =
  String(process.env.PLATFORM_SUPPORT_EMAIL || '').trim() || '';

export const PLATFORM_SUPPORT_WHATSAPP =
  String(process.env.PLATFORM_SUPPORT_WHATSAPP || '').trim() || '';

/** @deprecated Use PLATFORM_NAME for platform surfaces only. */
export const BRAND_NAME = PLATFORM_NAME;

/**
 * @deprecated Do not use for tenant-facing branding.
 * Prefer resolveAgencyBrand(agencyId) from agencyBrand.js.
 * Returns empty string so callers cannot accidentally paint HDN/Safi onto a tenant.
 */
export const defaultAgencyName = () => '';

export default {
  PLATFORM_NAME,
  PLATFORM_SUPPORT_EMAIL,
  PLATFORM_SUPPORT_WHATSAPP,
  BRAND_NAME,
  defaultAgencyName,
};
