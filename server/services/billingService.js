import Agency from '../models/Agency.js';
import AgencySubscription from '../models/AgencySubscription.js';
import BillingEvent from '../models/BillingEvent.js';
import Plan from '../models/Plan.js';
import User from '../models/User.js';
import { ensureDefaultPlans } from './planCatalog.js';
import {
  TRIAL_DAYS,
  LICENSE_STATUS,
  addDays,
  createTrialDefaults,
} from './licenseService.js';

const GRACE_DAYS = Math.max(0, Number(process.env.BILLING_GRACE_DAYS) || 7);

export const billingEnforcementEnabled = () =>
  String(process.env.BILLING_ENFORCEMENT || 'true').toLowerCase() !== 'false';

const snapshotOf = (sub) =>
  sub
    ? {
        planCode: sub.planCode,
        status: sub.status,
        trialEndsAt: sub.trialEndsAt,
        currentPeriodEnd: sub.currentPeriodEnd,
        provider: sub.provider,
      }
    : null;

export const recordBillingEvent = async ({
  agencyId,
  actorType = 'system',
  actorId = null,
  type,
  from = null,
  to = null,
  meta = {},
  idempotencyKey = null,
}) => {
  if (idempotencyKey) {
    const existing = await BillingEvent.findOne({ idempotencyKey }).lean();
    if (existing) return existing;
  }
  try {
    const payload = {
      agencyId,
      actorType,
      actorId,
      type,
      from,
      to,
      meta,
    };
    if (idempotencyKey) payload.idempotencyKey = idempotencyKey;
    return await BillingEvent.create(payload);
  } catch (error) {
    if (idempotencyKey && error?.code === 11000) {
      return BillingEvent.findOne({ idempotencyKey }).lean();
    }
    throw error;
  }
};

export const getPlanByCode = async (code) => {
  await ensureDefaultPlans();
  return Plan.findOne({ code: String(code || '').toLowerCase(), active: true }).lean();
};

/**
 * Map AgencySubscription → legacy User.license* for requireOwner compat.
 */
export const mapSubscriptionToUserLicense = (sub) => {
  if (!sub) {
    return { licenseStatus: LICENSE_STATUS.EXPIRED, trialStartedAt: null, trialEndsAt: null, licensedAt: null };
  }
  const status = sub.status;
  if (status === 'trialing') {
    return {
      licenseStatus: LICENSE_STATUS.TRIAL,
      trialStartedAt: sub.trialStartedAt,
      trialEndsAt: sub.trialEndsAt,
      licensedAt: null,
    };
  }
  if (status === 'active' || status === 'past_due') {
    return {
      licenseStatus: LICENSE_STATUS.ACTIVE,
      trialStartedAt: sub.trialStartedAt,
      trialEndsAt: sub.trialEndsAt,
      licensedAt: sub.currentPeriodStart || new Date(),
    };
  }
  // canceled / expired / suspended
  return {
    licenseStatus: LICENSE_STATUS.EXPIRED,
    trialStartedAt: sub.trialStartedAt,
    trialEndsAt: sub.trialEndsAt,
    licensedAt: null,
  };
};

export const syncOwnerLicenseFromSubscription = async (agencyId, sub = null) => {
  const agency = await Agency.findById(agencyId).select('primaryOwnerUserId').lean();
  if (!agency?.primaryOwnerUserId) return null;
  const current =
    sub ||
    (await AgencySubscription.findOne({ agencyId, isCurrent: true }));
  const mapped = mapSubscriptionToUserLicense(current);
  await User.updateOne(
    { _id: agency.primaryOwnerUserId, role: 'owner' },
    {
      $set: {
        licenseStatus: mapped.licenseStatus,
        trialStartedAt: mapped.trialStartedAt,
        trialEndsAt: mapped.trialEndsAt,
        licensedAt: mapped.licensedAt,
      },
    },
  );
  return mapped;
};

const featuresFromPlan = (plan) => {
  const f = plan?.features || {};
  return {
    maxVehicles: f.maxVehicles ?? null,
    maxStaff: f.maxStaff ?? null,
    maxBookingsPerMonth: f.maxBookingsPerMonth ?? null,
    maxStorageMb: f.maxStorageMb ?? null,
    customDomain: Boolean(f.customDomain),
    subdomain: f.subdomain !== false,
    whatsappSettings: f.whatsappSettings !== false,
    promotions: Boolean(f.promotions),
    contractsPdf: f.contractsPdf !== false,
    analytics: Boolean(f.analytics),
    apiAccess: Boolean(f.apiAccess),
    prioritySupport: Boolean(f.prioritySupport),
  };
};

/**
 * Lazy expiry / grace transitions for a subscription document.
 */
export const syncSubscriptionStatus = async (sub) => {
  if (!sub || !sub.isCurrent) return sub;
  const now = new Date();
  let changed = false;
  const before = snapshotOf(sub);

  if (sub.status === 'trialing' && sub.trialEndsAt && now > new Date(sub.trialEndsAt)) {
    sub.status = 'expired';
    sub.endedAt = sub.endedAt || now;
    changed = true;
  }

  if (
    sub.status === 'active' &&
    sub.cancelAtPeriodEnd &&
    sub.currentPeriodEnd &&
    now > new Date(sub.currentPeriodEnd)
  ) {
    sub.status = 'canceled';
    sub.endedAt = now;
    changed = true;
  }

  if (sub.status === 'past_due') {
    const graceEnd = sub.graceEndsAt ? new Date(sub.graceEndsAt) : null;
    if (graceEnd && now > graceEnd) {
      sub.status = 'expired';
      sub.endedAt = now;
      changed = true;
    }
  }

  if (changed) {
    await sub.save();
    await recordBillingEvent({
      agencyId: sub.agencyId,
      actorType: 'system',
      type: 'status_changed',
      from: before,
      to: snapshotOf(sub),
      meta: { reason: 'syncSubscriptionStatus' },
    });
    await syncOwnerLicenseFromSubscription(sub.agencyId, sub);
  }
  return sub;
};

export const getCurrentSubscription = async (agencyId) => {
  if (!agencyId) return null;
  let sub = await AgencySubscription.findOne({ agencyId, isCurrent: true });
  if (sub) {
    sub = await syncSubscriptionStatus(sub);
  }
  return sub;
};

/**
 * Create initial subscription for a new or migrated agency.
 */
export const ensureAgencySubscription = async (
  agencyId,
  {
    planCode = 'free_trial',
    status = null,
    trialStartedAt = null,
    trialEndsAt = null,
    actorType = 'system',
    actorId = null,
    notes = '',
  } = {},
) => {
  await ensureDefaultPlans();
  const existing = await AgencySubscription.findOne({ agencyId, isCurrent: true });
  if (existing) {
    return syncSubscriptionStatus(existing);
  }

  const plan = await getPlanByCode(planCode);
  if (!plan) throw Object.assign(new Error(`Unknown plan: ${planCode}`), { status: 400 });

  const now = new Date();
  const trialStart = trialStartedAt ? new Date(trialStartedAt) : now;
  const trialEnd =
    trialEndsAt
      ? new Date(trialEndsAt)
      : planCode === 'free_trial' || status === 'trialing'
        ? addDays(trialStart, plan.trialDaysDefault || TRIAL_DAYS)
        : null;

  let resolvedStatus = status;
  if (!resolvedStatus) {
    if (planCode === 'legacy_grandfathered') resolvedStatus = 'active';
    else if (trialEnd && trialEnd > now) resolvedStatus = 'trialing';
    else if (planCode === 'free_trial') resolvedStatus = 'expired';
    else resolvedStatus = 'active';
  }

  const sub = await AgencySubscription.create({
    agencyId,
    planCode: plan.code,
    status: resolvedStatus,
    provider: 'manual',
    trialStartedAt: trialStart,
    trialEndsAt: trialEnd,
    currentPeriodStart: resolvedStatus === 'active' ? now : null,
    currentPeriodEnd: null,
    limitsSnapshot: featuresFromPlan(plan),
    notes,
    createdBySuperAdminId: actorId,
    isCurrent: true,
  });

  await recordBillingEvent({
    agencyId,
    actorType,
    actorId,
    type: 'plan_assigned',
    from: null,
    to: snapshotOf(sub),
    meta: { planCode: plan.code },
  });
  await syncOwnerLicenseFromSubscription(agencyId, sub);
  return sub;
};

export const assignPlan = async (
  agencyId,
  planCode,
  {
    actorType = 'superadmin',
    actorId = null,
    trialDays = null,
    provider = 'manual',
    notes = '',
  } = {},
) => {
  await ensureDefaultPlans();
  const plan = await getPlanByCode(planCode);
  if (!plan) {
    const err = new Error(`Unknown plan: ${planCode}`);
    err.status = 400;
    throw err;
  }

  let sub = await getCurrentSubscription(agencyId);
  const before = snapshotOf(sub);
  const now = new Date();

  if (!sub) {
    sub = await ensureAgencySubscription(agencyId, {
      planCode: plan.code,
      actorType,
      actorId,
      notes,
    });
  }

  sub.planCode = plan.code;
  sub.limitsSnapshot = featuresFromPlan(plan);
  sub.provider = provider;
  sub.notes = notes || sub.notes;
  sub.cancelAtPeriodEnd = false;
  sub.canceledAt = null;
  sub.endedAt = null;
  sub.isCurrent = true;

  if (plan.code === 'free_trial' || (trialDays != null && Number(trialDays) > 0)) {
    const days = trialDays != null ? Math.max(1, Number(trialDays)) : plan.trialDaysDefault || TRIAL_DAYS;
    sub.status = 'trialing';
    sub.trialStartedAt = now;
    sub.trialEndsAt = addDays(now, days);
    sub.currentPeriodStart = null;
    sub.currentPeriodEnd = null;
  } else {
    sub.status = 'active';
    sub.trialEndsAt = sub.trialEndsAt || null;
    sub.currentPeriodStart = now;
    sub.currentPeriodEnd = addDays(now, plan.interval === 'year' ? 365 : 30);
  }

  await sub.save();
  await recordBillingEvent({
    agencyId,
    actorType,
    actorId,
    type: 'plan_assigned',
    from: before,
    to: snapshotOf(sub),
  });
  await syncOwnerLicenseFromSubscription(agencyId, sub);
  return sub;
};

export const expireSubscription = async (
  agencyId,
  { actorType = 'superadmin', actorId = null, notes = '' } = {},
) => {
  let sub = await getCurrentSubscription(agencyId);
  if (!sub) {
    sub = await ensureAgencySubscription(agencyId, {
      planCode: 'free_trial',
      status: 'expired',
      actorType,
      actorId,
    });
  }
  const before = snapshotOf(sub);
  sub.status = 'expired';
  sub.endedAt = new Date();
  sub.cancelAtPeriodEnd = false;
  if (notes) sub.notes = notes;
  await sub.save();
  await recordBillingEvent({
    agencyId,
    actorType,
    actorId,
    type: 'status_changed',
    from: before,
    to: snapshotOf(sub),
    meta: { action: 'expire' },
  });
  await syncOwnerLicenseFromSubscription(agencyId, sub);
  return sub;
};

export const extendTrial = async (agencyId, days, { actorType = 'superadmin', actorId = null } = {}) => {
  const n = Math.max(1, Number(days) || TRIAL_DAYS);
  let sub = await getCurrentSubscription(agencyId);
  if (!sub) {
    sub = await ensureAgencySubscription(agencyId, {
      planCode: 'free_trial',
      status: 'trialing',
      actorType,
      actorId,
    });
  }
  const before = snapshotOf(sub);
  const base =
    sub.trialEndsAt && new Date(sub.trialEndsAt) > new Date()
      ? new Date(sub.trialEndsAt)
      : new Date();
  sub.status = 'trialing';
  sub.trialStartedAt = sub.trialStartedAt || new Date();
  sub.trialEndsAt = addDays(base, n);
  sub.endedAt = null;
  sub.cancelAtPeriodEnd = false;
  await sub.save();
  await recordBillingEvent({
    agencyId,
    actorType,
    actorId,
    type: 'trial_extended',
    from: before,
    to: snapshotOf(sub),
    meta: { days: n },
  });
  await syncOwnerLicenseFromSubscription(agencyId, sub);
  return sub;
};

export const suspendSubscription = async (agencyId, { actorType = 'superadmin', actorId = null, notes = '' } = {}) => {
  let sub = await getCurrentSubscription(agencyId);
  if (!sub) {
    sub = await ensureAgencySubscription(agencyId, { planCode: 'free_trial', status: 'expired' });
  }
  const before = snapshotOf(sub);
  sub.status = 'suspended';
  if (notes) sub.notes = notes;
  await sub.save();
  await recordBillingEvent({
    agencyId,
    actorType,
    actorId,
    type: 'status_changed',
    from: before,
    to: snapshotOf(sub),
    meta: { action: 'suspend' },
  });
  await syncOwnerLicenseFromSubscription(agencyId, sub);
  return sub;
};

export const reactivateSubscription = async (
  agencyId,
  { actorType = 'superadmin', actorId = null, planCode = null } = {},
) => {
  let sub = await getCurrentSubscription(agencyId);
  if (!sub) {
    return assignPlan(agencyId, planCode || 'basic', { actorType, actorId });
  }
  if (planCode && planCode !== sub.planCode) {
    return assignPlan(agencyId, planCode, { actorType, actorId });
  }
  const before = snapshotOf(sub);
  if (sub.planCode === 'free_trial') {
    const now = new Date();
    if (sub.trialEndsAt && new Date(sub.trialEndsAt) > now) {
      sub.status = 'trialing';
    } else {
      return assignPlan(agencyId, 'basic', { actorType, actorId });
    }
  } else {
    sub.status = 'active';
    sub.endedAt = null;
    sub.currentPeriodStart = sub.currentPeriodStart || new Date();
    if (!sub.currentPeriodEnd) {
      sub.currentPeriodEnd = addDays(new Date(), 30);
    }
  }
  await sub.save();
  await recordBillingEvent({
    agencyId,
    actorType,
    actorId,
    type: 'reactivated',
    from: before,
    to: snapshotOf(sub),
  });
  await syncOwnerLicenseFromSubscription(agencyId, sub);
  return sub;
};

export const cancelSubscription = async (
  agencyId,
  { atPeriodEnd = true, actorType = 'superadmin', actorId = null } = {},
) => {
  const sub = await getCurrentSubscription(agencyId);
  if (!sub) {
    const err = new Error('No subscription');
    err.status = 404;
    throw err;
  }
  const before = snapshotOf(sub);
  if (atPeriodEnd && sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) > new Date()) {
    sub.cancelAtPeriodEnd = true;
    sub.canceledAt = new Date();
  } else {
    sub.status = 'canceled';
    sub.cancelAtPeriodEnd = false;
    sub.canceledAt = new Date();
    sub.endedAt = new Date();
  }
  await sub.save();
  await recordBillingEvent({
    agencyId,
    actorType,
    actorId,
    type: 'canceled',
    from: before,
    to: snapshotOf(sub),
    meta: { atPeriodEnd },
  });
  await syncOwnerLicenseFromSubscription(agencyId, sub);
  return sub;
};

/** Write access? past_due keeps write during grace. */
export const subscriptionAllowsWrite = (sub) => {
  if (!sub) return false;
  return ['trialing', 'active', 'past_due'].includes(sub.status);
};

export const serializeSubscription = (sub, plan = null) => {
  if (!sub) return null;
  const obj = sub.toObject ? sub.toObject() : { ...sub };
  return {
    agencyId: obj.agencyId,
    planCode: obj.planCode,
    status: obj.status,
    provider: obj.provider,
    trialStartedAt: obj.trialStartedAt,
    trialEndsAt: obj.trialEndsAt,
    currentPeriodStart: obj.currentPeriodStart,
    currentPeriodEnd: obj.currentPeriodEnd,
    cancelAtPeriodEnd: Boolean(obj.cancelAtPeriodEnd),
    canceledAt: obj.canceledAt,
    endedAt: obj.endedAt,
    graceEndsAt: obj.graceEndsAt,
    limits: obj.limitsSnapshot || featuresFromPlan(plan),
    plan: plan
      ? {
          code: plan.code,
          name: plan.name,
          priceAmount: plan.priceAmount,
          currency: plan.currency,
          interval: plan.interval,
          features: featuresFromPlan(plan),
        }
      : null,
    writeAllowed: subscriptionAllowsWrite(obj),
    storefrontAllowed: obj.status !== 'suspended',
  };
};

/**
 * Migrate one agency from User.license* into AgencySubscription.
 */
export const migrateAgencyBillingFromOwner = async (agency) => {
  const existing = await AgencySubscription.findOne({ agencyId: agency._id, isCurrent: true });
  if (existing) return { agencyId: agency._id, created: false, subscription: existing };

  const owner = await User.findById(agency.primaryOwnerUserId || agency.legacyOwnerId).lean();
  const defaults = createTrialDefaults(owner?.createdAt || agency.createdAt || new Date());

  let planCode = 'free_trial';
  let status = 'trialing';
  let trialStartedAt = owner?.trialStartedAt || defaults.trialStartedAt;
  let trialEndsAt = owner?.trialEndsAt || defaults.trialEndsAt;

  if (owner?.licenseStatus === LICENSE_STATUS.ACTIVE) {
    planCode = 'legacy_grandfathered';
    status = 'active';
  } else if (owner?.licenseStatus === LICENSE_STATUS.EXPIRED) {
    planCode = 'free_trial';
    status = 'expired';
  } else if (trialEndsAt && new Date(trialEndsAt) < new Date()) {
    status = 'expired';
  }

  const sub = await ensureAgencySubscription(agency._id, {
    planCode,
    status,
    trialStartedAt,
    trialEndsAt,
    actorType: 'system',
    notes: 'P4 migration from User.licenseStatus',
  });
  return { agencyId: agency._id, created: true, subscription: sub };
};

export const markPastDue = async (agencyId, { graceDays = GRACE_DAYS, meta = {} } = {}) => {
  const sub = await getCurrentSubscription(agencyId);
  if (!sub) return null;
  const before = snapshotOf(sub);
  sub.status = 'past_due';
  sub.graceEndsAt = addDays(new Date(), graceDays);
  await sub.save();
  await recordBillingEvent({
    agencyId,
    actorType: 'webhook',
    type: 'payment_failed',
    from: before,
    to: snapshotOf(sub),
    meta,
  });
  await syncOwnerLicenseFromSubscription(agencyId, sub);
  return sub;
};

export default {
  ensureDefaultPlans,
  ensureAgencySubscription,
  getCurrentSubscription,
  assignPlan,
  extendTrial,
  suspendSubscription,
  reactivateSubscription,
  cancelSubscription,
  expireSubscription,
  serializeSubscription,
  syncOwnerLicenseFromSubscription,
  migrateAgencyBillingFromOwner,
  subscriptionAllowsWrite,
  billingEnforcementEnabled,
  recordBillingEvent,
  mapSubscriptionToUserLicense,
};
