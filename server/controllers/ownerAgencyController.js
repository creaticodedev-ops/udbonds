import Agency from '../models/Agency.js';
import {
  buildStorefrontPath,
  buildStorefrontUrl,
  clearPublicTenantCache,
} from '../services/publicTenant.js';
import { resolveAgencyBrand, toPublicStorefrontProfile, normalizeHexColor } from '../services/agencyBrand.js';
import { updateWhatsAppSettings } from '../services/agencySettingsService.js';
import {
  serializeDomainState,
  setAgencyCustomDomain,
  clearAgencyCustomDomain,
  setSubdomainEnabled,
  verifyAgencyCustomDomain,
} from '../services/agencyDomainService.js';

const pickSocials = (input = {}) => ({
  instagram: String(input.instagram || '').trim(),
  facebook: String(input.facebook || '').trim(),
  tiktok: String(input.tiktok || '').trim(),
  youtube: String(input.youtube || '').trim(),
  website: String(input.website || '').trim(),
});

const serializeOwnerAgency = async (agency) => {
  const brand = await resolveAgencyBrand(agency);
  const domains = serializeDomainState(agency);
  return {
    ...toPublicStorefrontProfile(brand),
    _id: agency._id,
    status: agency.status || 'active',
    legalName: brand.legalName || '',
    taxId: brand.taxId || '',
    contractBranding: brand.contractBranding || {},
    isPublicStorefront: Boolean(agency.isPublicStorefront),
    onboardingCompletedAt: agency.onboardingCompletedAt || null,
    domains,
    storefrontUrl: domains.storefrontUrl || brand.storefrontUrl,
    storefrontPath: domains.slugStorefrontPath || brand.storefrontPath,
  };
};

/**
 * Owner-facing agency profile + public storefront URL for dashboard/settings.
 */
export const getOwnerAgency = async (req, res) => {
  try {
    const agency = req.agency;
    if (!agency) {
      return res.status(500).json({
        success: false,
        code: 'AGENCY_CONTEXT_MISSING',
        message: 'Agency context missing',
      });
    }

    res.json({
      success: true,
      agency: await serializeOwnerAgency(agency),
    });
  } catch (error) {
    console.error('[getOwnerAgency]', error.message);
    res.status(500).json({ success: false, message: 'Failed to load agency' });
  }
};

/**
 * Owner branding editor — updates Agency white-label fields only.
 */
export const updateOwnerAgencyBranding = async (req, res) => {
  try {
    if (!req.agencyId) {
      return res.status(500).json({
        success: false,
        code: 'AGENCY_CONTEXT_MISSING',
        message: 'Agency context missing',
      });
    }

    const agency = await Agency.findById(req.agencyId);
    if (!agency) {
      return res.status(404).json({ success: false, message: 'Agency not found' });
    }

    const body = req.body || {};
    if (body.name !== undefined) {
      const name = String(body.name || '').trim();
      if (name) agency.name = name;
    }
    if (body.logoUrl !== undefined) agency.logoUrl = String(body.logoUrl || '').trim();
    if (body.faviconUrl !== undefined) agency.faviconUrl = String(body.faviconUrl || '').trim();
    if (body.phone !== undefined) agency.phone = String(body.phone || '').trim();
    if (body.whatsapp !== undefined) agency.whatsapp = String(body.whatsapp || '').trim();
    if (body.email !== undefined) agency.email = String(body.email || '').trim().toLowerCase();
    if (body.address !== undefined) agency.address = String(body.address || '').trim();
    if (body.city !== undefined) agency.city = String(body.city || '').trim();
    if (body.country !== undefined) agency.country = String(body.country || '').trim();
    if (body.postalCode !== undefined) agency.postalCode = String(body.postalCode || '').trim();
    if (body.addressRegion !== undefined) agency.addressRegion = String(body.addressRegion || '').trim();
    if (body.legalName !== undefined) agency.legalName = String(body.legalName || '').trim();
    if (body.taxId !== undefined) agency.taxId = String(body.taxId || '').trim();
    if (body.primaryBrandColor !== undefined) {
      agency.primaryBrandColor = normalizeHexColor(body.primaryBrandColor, '') || String(body.primaryBrandColor || '').trim();
    }
    if (body.secondaryBrandColor !== undefined) {
      agency.secondaryBrandColor = normalizeHexColor(body.secondaryBrandColor, '') || String(body.secondaryBrandColor || '').trim();
    }
    if (body.socials && typeof body.socials === 'object') {
      agency.socials = { ...(agency.socials?.toObject?.() || agency.socials || {}), ...pickSocials(body.socials) };
    }
    if (body.seo && typeof body.seo === 'object') {
      agency.seo = {
        title: String(body.seo.title || '').trim().slice(0, 120),
        description: String(body.seo.description || '').trim().slice(0, 320),
        ogImageUrl: String(body.seo.ogImageUrl || '').trim(),
      };
    }
    if (body.hero && typeof body.hero === 'object') {
      agency.hero = {
        headline: String(body.hero.headline || '').trim().slice(0, 160),
        subheadline: String(body.hero.subheadline || '').trim().slice(0, 320),
        badgeText: String(body.hero.badgeText || '').trim().slice(0, 80),
        imageUrl: String(body.hero.imageUrl || '').trim(),
      };
    }
    if (body.contractBranding && typeof body.contractBranding === 'object') {
      const cb = body.contractBranding;
      agency.contractBranding = {
        companyName: String(cb.companyName || agency.name).trim(),
        logoUrl: String(cb.logoUrl || agency.logoUrl || '').trim(),
        showLogoOnPdf: cb.showLogoOnPdf !== false,
        footerNote: String(cb.footerNote || '').trim().slice(0, 500),
      };
    }

    await agency.save();

    if (agency.whatsapp || agency.phone) {
      try {
        const wa = agency.whatsapp || agency.phone;
        await updateWhatsAppSettings(
          agency.legacyOwnerId || req.user?._id,
          {
            whatsappReservationNumber: wa,
            whatsappConfirmationNumber: wa,
          },
          agency._id,
        );
      } catch (waErr) {
        console.warn('[updateOwnerAgencyBranding] whatsapp sync', waErr.message);
      }
    }

    clearPublicTenantCache();
    const fresh = agency.toObject();
    res.json({
      success: true,
      agency: await serializeOwnerAgency(fresh),
      storefrontPath: buildStorefrontPath(agency.slug),
      storefrontUrl: buildStorefrontUrl(agency.slug, agency),
    });
  } catch (error) {
    console.error('[updateOwnerAgencyBranding]', error.message);
    res.status(500).json({ success: false, message: 'Failed to update branding' });
  }
};

export const getOwnerAgencyDomains = async (req, res) => {
  try {
    if (!req.agency) {
      return res.status(500).json({ success: false, message: 'Agency context missing' });
    }
    res.json({ success: true, domains: serializeDomainState(req.agency) });
  } catch (error) {
    console.error('[getOwnerAgencyDomains]', error.message);
    res.status(500).json({ success: false, message: 'Failed to load domains' });
  }
};

export const updateOwnerAgencyDomain = async (req, res) => {
  try {
    if (!req.agencyId) {
      return res.status(500).json({ success: false, message: 'Agency context missing' });
    }
    const body = req.body || {};
    let agency;

    if (body.clear === true || body.customDomain === '') {
      agency = await clearAgencyCustomDomain(req.agencyId);
    } else if (body.customDomain !== undefined) {
      const { assertFeature } = await import('../services/entitlementsService.js');
      await assertFeature(req.agencyId, 'customDomain');
      agency = await setAgencyCustomDomain(req.agencyId, body.customDomain);
    } else {
      agency = await Agency.findById(req.agencyId);
    }

    if (body.subdomainEnabled !== undefined) {
      agency = await setSubdomainEnabled(req.agencyId, body.subdomainEnabled);
    }

    res.json({
      success: true,
      domains: serializeDomainState(agency),
      agency: await serializeOwnerAgency(agency.toObject ? agency.toObject() : agency),
    });
  } catch (error) {
    console.error('[updateOwnerAgencyDomain]', error.message);
    res.status(error.status || 500).json({
      success: false,
      code: error.code,
      message: error.message || 'Failed to update domain',
    });
  }
};

export const verifyOwnerAgencyDomain = async (req, res) => {
  try {
    if (!req.agencyId) {
      return res.status(500).json({ success: false, message: 'Agency context missing' });
    }
    const { assertFeature } = await import('../services/entitlementsService.js');
    await assertFeature(req.agencyId, 'customDomain');
    const agency = await verifyAgencyCustomDomain(req.agencyId, { force: false });
    res.json({
      success: true,
      domains: serializeDomainState(agency),
      agency: await serializeOwnerAgency(agency.toObject ? agency.toObject() : agency),
    });
  } catch (error) {
    console.error('[verifyOwnerAgencyDomain]', error.message);
    res.status(error.status || 500).json({
      success: false,
      code: error.code,
      message: error.message || 'Domain verification failed',
    });
  }
};

export default {
  getOwnerAgency,
  updateOwnerAgencyBranding,
  getOwnerAgencyDomains,
  updateOwnerAgencyDomain,
  verifyOwnerAgencyDomain,
};
