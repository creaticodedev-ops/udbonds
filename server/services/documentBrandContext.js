/**
 * Async helper: ensure template variable builders receive tenant brand.
 */
import {
  resolveBrandForContext,
  brandToTemplateAgency,
} from './agencyBrand.js';

export const withAgencyForDocuments = async ({
  booking = null,
  owner = null,
  agencyId = null,
  agency = null,
} = {}) => {
  if (agency && (agency.name || agency.contractBranding || agency.agencyId)) {
    // Already a brand or lean agency with fields
    if (agency.contractBranding && agency.primaryBrandColor !== undefined) {
      return brandToTemplateAgency(agency);
    }
    if (agency.agencyId || agency._id) {
      const brand = await resolveBrandForContext({
        agencyId: agency.agencyId || agency._id,
        owner,
        booking,
      });
      return brandToTemplateAgency(brand);
    }
    return agency;
  }
  const brand = await resolveBrandForContext({ agencyId, owner, booking });
  return brandToTemplateAgency(brand);
};

export default { withAgencyForDocuments };
