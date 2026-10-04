import {
  evaluateLicense,
  syncLicenseStatus,
  LICENSE_EXPIRED_CODE,
  serializeLicense,
} from '../services/licenseService.js';
import { BRAND_NAME } from '../utils/brand.js';
import { attachAgency } from './attachAgency.js';
import Agency from '../models/Agency.js';
import {
  getCurrentSubscription,
  migrateAgencyBillingFromOwner,
  syncOwnerLicenseFromSubscription,
  subscriptionAllowsWrite,
  mapSubscriptionToUserLicense,
  billingEnforcementEnabled,
} from '../services/billingService.js';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const isAgencyDashboardRole = (role) => role === 'owner' || role === 'staff';

/**
 * Ensures the authenticated user is an agency owner or staff member.
 * Writes require an active agency subscription (trialing / active / past_due).
 * Staff inherit agency billing; only owners sync User.license* dual-write.
 * Also attaches req.agencyId via attachAgency (P1).
 */
export const requireOwner = async (req, res, next) => {
  try {
    if (!isAgencyDashboardRole(req.user?.role)) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (req.user.accountStatus && req.user.accountStatus !== 'active') {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_LOCKED',
        message: `This admin account has been suspended or disabled. Contact ${BRAND_NAME}.`,
      });
    }

    let writeAllowed = true;
    let licensePayload = null;

    if (req.user.agencyId && billingEnforcementEnabled()) {
      let sub = await getCurrentSubscription(req.user.agencyId);
      if (!sub) {
        const agency = await Agency.findById(req.user.agencyId).lean();
        if (agency) {
          await migrateAgencyBillingFromOwner(agency);
          sub = await getCurrentSubscription(req.user.agencyId);
        }
      }
      if (sub) {
        if (req.user.role === 'owner') {
          await syncOwnerLicenseFromSubscription(req.user.agencyId, sub);
          const mapped = mapSubscriptionToUserLicense(sub);
          Object.assign(req.user, mapped);
        }
        writeAllowed = subscriptionAllowsWrite(sub);
        req.subscription = sub;
        licensePayload = {
          ...(req.user.role === 'owner'
            ? serializeLicense(req.user)
            : {
                licenseStatus: writeAllowed ? 'active' : 'expired',
                trialEndsAt: sub.trialEndsAt,
                daysRemaining: null,
                allowed: writeAllowed,
              }),
          allowed: writeAllowed,
          subscriptionStatus: sub.status,
          planCode: sub.planCode,
          writeAllowed,
        };
      } else if (req.user.role === 'owner') {
        await syncLicenseStatus(req.user);
        const evaluation = evaluateLicense(req.user);
        writeAllowed = evaluation.allowed;
        licensePayload = {
          ...serializeLicense(req.user),
          allowed: writeAllowed,
          writeAllowed,
        };
      } else {
        writeAllowed = false;
        licensePayload = {
          licenseStatus: 'expired',
          allowed: false,
          writeAllowed: false,
        };
      }
    } else if (req.user.role === 'owner') {
      await syncLicenseStatus(req.user);
      const evaluation = evaluateLicense(req.user);
      writeAllowed = evaluation.allowed;
      licensePayload = {
        ...serializeLicense(req.user),
        allowed: writeAllowed,
        writeAllowed,
      };
    }

    req.billingWriteAllowed = writeAllowed;
    req.license = licensePayload;
    req.isAgencyOwner = req.user.role === 'owner';
    req.isAgencyStaff = req.user.role === 'staff';

    if (!writeAllowed && !READ_METHODS.has(String(req.method || 'GET').toUpperCase())) {
      return res.status(403).json({
        success: false,
        code: LICENSE_EXPIRED_CODE,
        billingCode: 'BILLING_LOCKED',
        message: `Your subscription is inactive. Contact ${BRAND_NAME} to reactivate. Dashboard remains read-only.`,
        license: licensePayload,
      });
    }

    return attachAgency(req, res, next);
  } catch (error) {
    console.error('[license]', error.message);
    return res.status(500).json({ success: false, message: 'License check failed' });
  }
};

/** Owner role only (staff blocked) — billing, domains, staff admin, etc. */
export const requireAgencyOwnerRole = (req, res, next) => {
  if (req.user?.role !== 'owner') {
    return res.status(403).json({
      success: false,
      code: 'OWNER_ONLY',
      message: 'Only the agency owner can perform this action',
    });
  }
  return next();
};
