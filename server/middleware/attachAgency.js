import Agency from '../models/Agency.js';
import { ensureAgencyForOwner } from '../services/agencyMigration.js';

/**
 * Attaches req.agencyId / req.agency / req.agencyLegacyOwnerId for owner & staff routes.
 * Auto-provisions a missing Agency for legacy owners only (idempotent, non-destructive).
 */
export const attachAgency = async (req, res, next) => {
  try {
    const role = req.user?.role;
    if (!req.user || (role !== 'owner' && role !== 'staff')) {
      return next();
    }

    let agency = null;
    if (req.user.agencyId) {
      agency = await Agency.findById(req.user.agencyId).lean();
    }
    if (!agency && role === 'owner') {
      agency = await ensureAgencyForOwner(req.user);
      if (agency && !req.user.agencyId) {
        req.user.agencyId = agency._id;
      }
    }

    if (!agency) {
      console.error(`[attachAgency] Failed to resolve agency for ${role} ${req.user._id}`);
      return res.status(500).json({
        success: false,
        code: 'AGENCY_CONTEXT_MISSING',
        message: 'Agency context could not be established for this account',
      });
    }

    // Staff must belong to this agency
    if (
      role === 'staff' &&
      req.user.agencyId &&
      String(req.user.agencyId) !== String(agency._id)
    ) {
      return res.status(403).json({
        success: false,
        code: 'AGENCY_MISMATCH',
        message: 'Staff account is not linked to this agency',
      });
    }

    if (agency.status && agency.status !== 'active') {
      return res.status(403).json({
        success: false,
        code: 'AGENCY_LOCKED',
        message: 'This agency has been suspended or disabled',
      });
    }

    req.agency = agency;
    req.agencyId = agency._id;
    req.agencyLegacyOwnerId = agency.legacyOwnerId || agency.primaryOwnerUserId || req.user._id;
    return next();
  } catch (error) {
    console.error('[attachAgency]', error.message);
    return res.status(500).json({
      success: false,
      code: 'AGENCY_CONTEXT_MISSING',
      message: 'Agency context could not be established',
    });
  }
};

export default attachAgency;
