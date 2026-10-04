import Agency from '../models/Agency.js';
import {
  requirePublicAgency,
} from '../services/publicTenant.js';
import {
  resolveAgencyBrand,
  toPublicStorefrontProfile,
} from '../services/agencyBrand.js';
import {
  getOrCreateAgencySettings,
  serializeAgencySettings,
} from '../services/agencySettingsService.js';

/**
 * Public agency profile for a slug storefront (or default public tenant).
 * Safe fields only — never exposes owner password, invite tokens, or internals.
 * Never falls back to another agency's branding.
 */
export const getPublicStorefront = async (req, res) => {
  try {
    const agency = await requirePublicAgency(req, res);
    if (!agency) return;

    if (!agency.agencyId) {
      return res.json({
        success: true,
        storefront: toPublicStorefrontProfile({
          agencyId: null,
          name: agency.name || '',
          slug: agency.slug || '',
          logoUrl: '',
          faviconUrl: '',
          phone: '',
          whatsapp: '',
          email: '',
          address: '',
          city: '',
          country: '',
          postalCode: '',
          addressRegion: '',
          primaryBrandColor: '',
          secondaryBrandColor: '',
          socials: {},
          seo: {},
          hero: {},
          currency: 'MAD',
          locale: 'fr-MA',
          timezone: 'Africa/Casablanca',
          storefrontPath: agency.slug ? `/s/${agency.slug}` : '/',
          storefrontUrl: '',
        }),
      });
    }

    const doc = await Agency.findById(agency.agencyId).lean();
    if (!doc || doc.status !== 'active') {
      return res.status(404).json({
        success: false,
        code: 'PUBLIC_AGENCY_NOT_FOUND',
        message: 'Agency storefront not found',
      });
    }

    // Billing suspended → storefront off (expired stays on for lead gen)
    try {
      const { getCurrentSubscription } = await import('../services/billingService.js');
      const sub = await getCurrentSubscription(doc._id);
      if (sub?.status === 'suspended') {
        return res.status(404).json({
          success: false,
          code: 'STOREFRONT_SUSPENDED',
          message: 'Agency storefront temporarily unavailable',
        });
      }
    } catch {
      /* billing optional for public */
    }

    let settings = null;
    try {
      settings = await serializeAgencySettings(
        agency.legacyOwnerId,
        await getOrCreateAgencySettings(agency.legacyOwnerId, agency.agencyId),
        agency.agencyId,
      );
    } catch {
      /* settings optional */
    }

    const brand = await resolveAgencyBrand(doc, { settings });
    if (!brand.whatsapp && settings?.whatsappReservationNumber) {
      brand.whatsapp = settings.whatsappReservationNumber;
      brand.whatsappDial = settings.effective?.reservationDial || brand.whatsappDial;
    }

    res.json({
      success: true,
      storefront: toPublicStorefrontProfile(brand),
    });
  } catch (error) {
    console.error('[getPublicStorefront]', error.message);
    res.status(500).json({ success: false, message: 'Failed to load storefront' });
  }
};

export default { getPublicStorefront };
