import Agency from '../models/Agency.js';
import AgencySettings from '../models/AgencySettings.js';
import { buildStorefrontPath, buildStorefrontUrl } from './publicTenant.js';

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Local copy — avoid circular import with whatsappNotify.js */
const normalizeWhatsAppDial = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0') && digits.length === 10) return `212${digits.slice(1)}`;
  return digits;
};

export const normalizeHexColor = (value, fallback = '') => {
  const raw = String(value || '').trim();
  if (HEX.test(raw)) return raw.length === 4
    ? `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`
    : raw;
  return fallback;
};

/**
 * Resolve white-label brand for a tenant.
 * Never returns another agency's branding.
 * Missing fields stay empty (neutral) — callers hide UI / use placeholders.
 *
 * @param {string|import('mongoose').Types.ObjectId|object} agencyOrId
 * @param {{ settings?: object }} [opts]
 */
export const resolveAgencyBrand = async (agencyOrId, opts = {}) => {
  let agency = agencyOrId;
  if (!agency) {
    return emptyBrand();
  }
  if (typeof agency === 'string' || agency._bsontype === 'ObjectId' || agency.constructor?.name === 'ObjectId') {
    agency = await Agency.findById(agency).lean();
  } else if (agency.toObject) {
    agency = agency.toObject();
  }

  if (!agency?._id) return emptyBrand();

  let settings = opts.settings || null;
  if (!settings) {
    try {
      settings = await AgencySettings.findOne({
        $or: [{ agencyId: agency._id }, { owner: agency.legacyOwnerId }],
      }).lean();
    } catch {
      settings = null;
    }
  }

  const whatsapp =
    String(agency.whatsapp || '').trim() ||
    String(settings?.whatsappReservationNumber || '').trim() ||
    '';
  const phone = String(agency.phone || '').trim() || whatsapp;
  const email = String(agency.email || '').trim().toLowerCase();
  const name = String(agency.name || '').trim();
  const legalName = String(agency.legalName || agency.contractBranding?.companyName || name).trim();
  const primaryBrandColor = normalizeHexColor(agency.primaryBrandColor, '');
  const secondaryBrandColor = normalizeHexColor(agency.secondaryBrandColor, '');
  const logoUrl = String(agency.logoUrl || '').trim();
  const contractLogo =
    String(agency.contractBranding?.logoUrl || '').trim() || logoUrl;
  const showLogoOnPdf = agency.contractBranding?.showLogoOnPdf !== false;
  const slug = String(agency.slug || '').trim();

  return {
    agencyId: agency._id,
    name,
    legalName,
    slug,
    logoUrl,
    faviconUrl: String(agency.faviconUrl || logoUrl || '').trim(),
    phone,
    whatsapp,
    whatsappDial: normalizeWhatsAppDial(whatsapp) || '',
    email,
    address: String(agency.address || '').trim(),
    city: String(agency.city || '').trim(),
    country: String(agency.country || '').trim(),
    postalCode: String(agency.postalCode || '').trim(),
    addressRegion: String(agency.addressRegion || '').trim(),
    taxId: String(agency.taxId || '').trim(),
    primaryBrandColor,
    secondaryBrandColor,
    socials: {
      instagram: String(agency.socials?.instagram || '').trim(),
      facebook: String(agency.socials?.facebook || '').trim(),
      tiktok: String(agency.socials?.tiktok || '').trim(),
      youtube: String(agency.socials?.youtube || '').trim(),
      website: String(agency.socials?.website || '').trim(),
    },
    seo: {
      title: String(agency.seo?.title || '').trim() || (name ? `${name}` : ''),
      description:
        String(agency.seo?.description || '').trim() ||
        (name ? `Car rental with ${name}` : ''),
      ogImageUrl: String(agency.seo?.ogImageUrl || logoUrl || '').trim(),
    },
    hero: {
      headline: String(agency.hero?.headline || '').trim(),
      subheadline: String(agency.hero?.subheadline || '').trim(),
      badgeText: String(agency.hero?.badgeText || '').trim(),
      imageUrl: String(agency.hero?.imageUrl || '').trim(),
    },
    contractBranding: {
      companyName: String(agency.contractBranding?.companyName || legalName || name).trim(),
      logoUrl: contractLogo,
      showLogoOnPdf,
      footerNote: String(agency.contractBranding?.footerNote || '').trim(),
    },
    currency: agency.currency || 'MAD',
    locale: agency.locale || 'fr-MA',
    timezone: agency.timezone || 'Africa/Casablanca',
    storefrontPath: buildStorefrontPath(slug),
    storefrontUrl: buildStorefrontUrl(slug, agency),
  };
};

export const emptyBrand = () => ({
  agencyId: null,
  name: '',
  legalName: '',
  slug: '',
  logoUrl: '',
  faviconUrl: '',
  phone: '',
  whatsapp: '',
  whatsappDial: '',
  email: '',
  address: '',
  city: '',
  country: '',
  postalCode: '',
  addressRegion: '',
  taxId: '',
  primaryBrandColor: '',
  secondaryBrandColor: '',
  socials: { instagram: '', facebook: '', tiktok: '', youtube: '', website: '' },
  seo: { title: '', description: '', ogImageUrl: '' },
  hero: { headline: '', subheadline: '', badgeText: '', imageUrl: '' },
  contractBranding: { companyName: '', logoUrl: '', showLogoOnPdf: true, footerNote: '' },
  currency: 'MAD',
  locale: 'fr-MA',
  timezone: 'Africa/Casablanca',
  storefrontPath: '/',
  storefrontUrl: '',
});

/** Safe public JSON for storefront profile (no internals). */
export const toPublicStorefrontProfile = (brand) => ({
  agencyId: brand.agencyId ? String(brand.agencyId) : null,
  name: brand.name || '',
  slug: brand.slug || '',
  logoUrl: brand.logoUrl || '',
  faviconUrl: brand.faviconUrl || '',
  phone: brand.phone || '',
  whatsapp: brand.whatsapp || '',
  email: brand.email || '',
  address: brand.address || '',
  city: brand.city || '',
  country: brand.country || '',
  postalCode: brand.postalCode || '',
  addressRegion: brand.addressRegion || '',
  primaryBrandColor: brand.primaryBrandColor || '',
  secondaryBrandColor: brand.secondaryBrandColor || '',
  socials: brand.socials || {},
  seo: brand.seo || {},
  hero: brand.hero || {},
  currency: brand.currency || 'MAD',
  locale: brand.locale || 'fr-MA',
  timezone: brand.timezone || 'Africa/Casablanca',
  storefrontPath: brand.storefrontPath || '/',
  storefrontUrl: brand.storefrontUrl || '',
});

/**
 * Resolve brand for document/email/WhatsApp from booking or owner context.
 * Prefer agencyId (canonical); never invent another tenant's branding.
 */
export const resolveBrandForContext = async ({
  agencyId = null,
  owner = null,
  booking = null,
} = {}) => {
  const id =
    agencyId ||
    booking?.agencyId ||
    owner?.agencyId ||
    null;
  if (id) return resolveAgencyBrand(id);

  const legacyOwnerId = owner?._id || booking?.owner || null;
  if (legacyOwnerId) {
    const agency = await Agency.findOne({
      $or: [{ legacyOwnerId }, { primaryOwnerUserId: legacyOwnerId }],
    }).lean();
    if (agency) return resolveAgencyBrand(agency);
  }
  return emptyBrand();
};

/** Map brand → templateEngine `agency` object (includes contract fields). */
export const brandToTemplateAgency = (brand) => {
  if (!brand?.agencyId && !brand?.name) return {};
  return {
    name: brand.contractBranding?.companyName || brand.name || '',
    email: brand.email || '',
    phone: brand.phone || '',
    address: [brand.address, brand.city, brand.country].filter(Boolean).join(', '),
    taxId: brand.taxId || '',
    currency: brand.currency || 'MAD',
    primaryBrandColor: brand.primaryBrandColor || '',
    logoUrl: brand.contractBranding?.showLogoOnPdf === false
      ? ''
      : brand.contractBranding?.logoUrl || brand.logoUrl || '',
    contractBranding: brand.contractBranding || {},
    legalName: brand.legalName || brand.name || '',
  };
};

export default {
  resolveAgencyBrand,
  emptyBrand,
  toPublicStorefrontProfile,
  normalizeHexColor,
  resolveBrandForContext,
  brandToTemplateAgency,
};
