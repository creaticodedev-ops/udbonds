import Car from '../models/Car.js';
import Plan from '../models/Plan.js';
import {
  getCurrentSubscription,
  ensureAgencySubscription,
  billingEnforcementEnabled,
  serializeSubscription,
} from './billingService.js';
import { ensureDefaultPlans } from './planCatalog.js';

export class EntitlementError extends Error {
  constructor(message, { code = 'ENTITLEMENT_DENIED', status = 403, meta = {} } = {}) {
    super(message);
    this.name = 'EntitlementError';
    this.code = code;
    this.status = status;
    this.meta = meta;
  }
}

export const getAgencyEntitlements = async (agencyId) => {
  await ensureDefaultPlans();
  let sub = await getCurrentSubscription(agencyId);
  if (!sub && agencyId) {
    sub = await ensureAgencySubscription(agencyId, { planCode: 'free_trial' });
  }
  const plan = sub
    ? await Plan.findOne({ code: sub.planCode }).lean()
    : await Plan.findOne({ code: 'free_trial' }).lean();
  const limits = sub?.limitsSnapshot || plan?.features || {};
  return {
    subscription: serializeSubscription(sub, plan),
    limits: {
      maxVehicles: limits.maxVehicles ?? null,
      maxStaff: limits.maxStaff ?? null,
      maxBookingsPerMonth: limits.maxBookingsPerMonth ?? null,
      maxStorageMb: limits.maxStorageMb ?? null,
      customDomain: Boolean(limits.customDomain),
      subdomain: limits.subdomain !== false,
      whatsappSettings: limits.whatsappSettings !== false,
      promotions: Boolean(limits.promotions),
      contractsPdf: limits.contractsPdf !== false,
      analytics: Boolean(limits.analytics),
      apiAccess: Boolean(limits.apiAccess),
      prioritySupport: Boolean(limits.prioritySupport),
    },
    writeAllowed: ['trialing', 'active', 'past_due'].includes(sub?.status),
    enforcement: billingEnforcementEnabled(),
  };
};

export const getAgencyUsage = async (agencyId) => {
  const vehicles = agencyId ? await Car.countDocuments({ agencyId }) : 0;
  let staff = 1;
  if (agencyId) {
    const { countAgencyStaffSeats } = await import('./staffService.js');
    staff = await countAgencyStaffSeats(agencyId);
  }
  return {
    vehicles,
    staff,
    bookingsThisMonth: null,
    storageMb: null,
  };
};

export const assertFeature = async (agencyId, featureKey) => {
  const ent = await getAgencyEntitlements(agencyId);
  if (!ent.enforcement) return ent;
  if (!ent.writeAllowed && featureKey !== 'read') {
    throw new EntitlementError('Subscription inactive. Upgrade or contact support.', {
      code: 'BILLING_LOCKED',
      meta: { status: ent.subscription?.status },
    });
  }
  const allowed = ent.limits[featureKey];
  if (allowed === false) {
    throw new EntitlementError(`Your plan does not include ${featureKey}.`, {
      code: 'FEATURE_LOCKED',
      meta: { feature: featureKey, planCode: ent.subscription?.planCode },
    });
  }
  return ent;
};

export const assertWithinLimit = async (agencyId, limitKey, currentCount) => {
  const ent = await getAgencyEntitlements(agencyId);
  if (!ent.enforcement) return ent;
  if (!ent.writeAllowed) {
    throw new EntitlementError('Subscription inactive. Upgrade or contact support.', {
      code: 'BILLING_LOCKED',
    });
  }
  const max = ent.limits[limitKey];
  if (max == null) return ent;
  if (Number(currentCount) >= Number(max)) {
    throw new EntitlementError(`Plan limit reached for ${limitKey} (${max}).`, {
      code: 'LIMIT_REACHED',
      meta: { limitKey, max, current: currentCount, planCode: ent.subscription?.planCode },
    });
  }
  return ent;
};

export const assertCanAddVehicle = async (agencyId) => {
  const usage = await getAgencyUsage(agencyId);
  return assertWithinLimit(agencyId, 'maxVehicles', usage.vehicles);
};

export default {
  getAgencyEntitlements,
  getAgencyUsage,
  assertFeature,
  assertWithinLimit,
  assertCanAddVehicle,
  EntitlementError,
};
