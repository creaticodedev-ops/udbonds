import Agency from '../models/Agency.js';
import Plan from '../models/Plan.js';
import BillingEvent from '../models/BillingEvent.js';
import {
  getCurrentSubscription,
  ensureAgencySubscription,
  assignPlan,
  extendTrial,
  suspendSubscription,
  reactivateSubscription,
  cancelSubscription,
  expireSubscription,
  serializeSubscription,
  migrateAgencyBillingFromOwner,
  subscriptionAllowsWrite,
} from '../services/billingService.js';
import {
  getAgencyEntitlements,
  getAgencyUsage,
} from '../services/entitlementsService.js';
import { ensureDefaultPlans } from '../services/planCatalog.js';
import { serializeLicense } from '../services/licenseService.js';
import { PLATFORM_NAME } from '../utils/brand.js';

const ensureSub = async (agencyId) => {
  let sub = await getCurrentSubscription(agencyId);
  if (!sub) {
    const agency = await Agency.findById(agencyId).lean();
    if (agency) {
      await migrateAgencyBillingFromOwner(agency);
      sub = await getCurrentSubscription(agencyId);
    }
  }
  if (!sub) {
    sub = await ensureAgencySubscription(agencyId, { planCode: 'free_trial' });
  }
  return sub;
};

export const listPublicPlans = async (req, res) => {
  try {
    const plans = await ensureDefaultPlans();
    const isSuperAdmin = req.user?.role === 'superadmin';
    res.json({
      success: true,
      plans: plans
        .filter((p) => isSuperAdmin || p.isPublic || p.code === 'free_trial')
        .map((p) => ({
          code: p.code,
          name: p.name,
          description: p.description,
          priceAmount: p.priceAmount,
          currency: p.currency,
          interval: p.interval,
          features: p.features,
          trialDaysDefault: p.trialDaysDefault,
          isPublic: p.isPublic,
        })),
    });
  } catch (error) {
    console.error('[listPublicPlans]', error.message);
    res.status(500).json({ success: false, message: 'Failed to list plans' });
  }
};

export const getOwnerBilling = async (req, res) => {
  try {
    if (!req.agencyId) {
      return res.status(500).json({ success: false, message: 'Agency context missing' });
    }
    await ensureSub(req.agencyId);
    const [ent, usage, plans] = await Promise.all([
      getAgencyEntitlements(req.agencyId),
      getAgencyUsage(req.agencyId),
      ensureDefaultPlans(),
    ]);
    res.json({
      success: true,
      billing: {
        subscription: ent.subscription,
        limits: ent.limits,
        usage,
        writeAllowed: ent.writeAllowed,
        supportContact: PLATFORM_NAME,
      },
      plans: plans
        .filter((p) => p.isPublic)
        .map((p) => ({
          code: p.code,
          name: p.name,
          description: p.description,
          priceAmount: p.priceAmount,
          currency: p.currency,
          interval: p.interval,
          features: p.features,
        })),
      license: serializeLicense(req.user),
    });
  } catch (error) {
    console.error('[getOwnerBilling]', error.message);
    res.status(500).json({ success: false, message: 'Failed to load billing' });
  }
};

export const cancelOwnerBilling = async (req, res) => {
  try {
    if (!req.agencyId) {
      return res.status(500).json({ success: false, message: 'Agency context missing' });
    }
    const sub = await ensureSub(req.agencyId);
    if (!subscriptionAllowsWrite(sub)) {
      return res.status(403).json({
        success: false,
        code: 'BILLING_LOCKED',
        message: 'Subscription is not active',
      });
    }
    const atPeriodEnd = req.body?.atPeriodEnd !== false;
    const updated = await cancelSubscription(req.agencyId, {
      atPeriodEnd,
      actorType: 'owner',
      actorId: req.user._id,
    });
    const plan = await Plan.findOne({ code: updated.planCode }).lean();
    res.json({
      success: true,
      message: atPeriodEnd ? 'Cancellation scheduled at period end' : 'Subscription canceled',
      subscription: serializeSubscription(updated, plan),
    });
  } catch (error) {
    console.error('[cancelOwnerBilling]', error.message);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to cancel subscription',
    });
  }
};

/** Stripe checkout stub — enabled later via STRIPE_BILLING_ENABLED */
export const checkoutOwnerBilling = async (req, res) => {
  const enabled = String(process.env.STRIPE_BILLING_ENABLED || '').toLowerCase() === 'true';
  if (!enabled) {
    return res.status(501).json({
      success: false,
      code: 'STRIPE_BILLING_DISABLED',
      message: `Self-serve checkout is not enabled. Contact ${PLATFORM_NAME} to upgrade.`,
    });
  }
  return res.status(501).json({
    success: false,
    message: 'Stripe Billing checkout is not configured yet',
  });
};

// ─── Super Admin ─────────────────────────────────────────

export const getSuperAdminAgencyBilling = async (req, res) => {
  try {
    const agencyId = req.params.id;
    const agency = await Agency.findById(agencyId).lean();
    if (!agency) {
      return res.status(404).json({ success: false, message: 'Agency not found' });
    }
    await ensureSub(agencyId);
    const [ent, usage, events] = await Promise.all([
      getAgencyEntitlements(agencyId),
      getAgencyUsage(agencyId),
      BillingEvent.find({ agencyId }).sort({ createdAt: -1 }).limit(40).lean(),
    ]);
    res.json({
      success: true,
      agencyId,
      billing: {
        subscription: ent.subscription,
        limits: ent.limits,
        usage,
        writeAllowed: ent.writeAllowed,
      },
      events,
    });
  } catch (error) {
    console.error('[getSuperAdminAgencyBilling]', error.message);
    res.status(500).json({ success: false, message: 'Failed to load agency billing' });
  }
};

export const assignSuperAdminAgencyPlan = async (req, res) => {
  try {
    const { planCode, trialDays, notes } = req.body || {};
    if (!planCode) {
      return res.status(400).json({ success: false, message: 'planCode is required' });
    }
    const sub = await assignPlan(req.params.id, planCode, {
      actorType: 'superadmin',
      actorId: req.user._id,
      trialDays: trialDays != null ? Number(trialDays) : null,
      notes: notes || '',
    });
    const plan = await Plan.findOne({ code: sub.planCode }).lean();
    res.json({
      success: true,
      message: `Plan ${planCode} assigned`,
      subscription: serializeSubscription(sub, plan),
    });
  } catch (error) {
    console.error('[assignSuperAdminAgencyPlan]', error.message);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to assign plan',
    });
  }
};

export const extendSuperAdminAgencyTrial = async (req, res) => {
  try {
    const days = Math.max(1, Number(req.body?.days) || 7);
    const sub = await extendTrial(req.params.id, days, {
      actorType: 'superadmin',
      actorId: req.user._id,
    });
    const plan = await Plan.findOne({ code: sub.planCode }).lean();
    res.json({
      success: true,
      message: `Trial extended by ${days} day(s)`,
      subscription: serializeSubscription(sub, plan),
    });
  } catch (error) {
    console.error('[extendSuperAdminAgencyTrial]', error.message);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to extend trial',
    });
  }
};

export const suspendSuperAdminAgencyBilling = async (req, res) => {
  try {
    const sub = await suspendSubscription(req.params.id, {
      actorType: 'superadmin',
      actorId: req.user._id,
      notes: req.body?.notes || '',
    });
    const plan = await Plan.findOne({ code: sub.planCode }).lean();
    res.json({
      success: true,
      message: 'Subscription suspended',
      subscription: serializeSubscription(sub, plan),
    });
  } catch (error) {
    console.error('[suspendSuperAdminAgencyBilling]', error.message);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to suspend',
    });
  }
};

export const reactivateSuperAdminAgencyBilling = async (req, res) => {
  try {
    const sub = await reactivateSubscription(req.params.id, {
      actorType: 'superadmin',
      actorId: req.user._id,
      planCode: req.body?.planCode || null,
    });
    const plan = await Plan.findOne({ code: sub.planCode }).lean();
    res.json({
      success: true,
      message: 'Subscription reactivated',
      subscription: serializeSubscription(sub, plan),
    });
  } catch (error) {
    console.error('[reactivateSuperAdminAgencyBilling]', error.message);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to reactivate',
    });
  }
};

export const cancelSuperAdminAgencyBilling = async (req, res) => {
  try {
    const atPeriodEnd = req.body?.atPeriodEnd !== false;
    const sub = await cancelSubscription(req.params.id, {
      atPeriodEnd,
      actorType: 'superadmin',
      actorId: req.user._id,
    });
    const plan = await Plan.findOne({ code: sub.planCode }).lean();
    res.json({
      success: true,
      message: 'Subscription canceled',
      subscription: serializeSubscription(sub, plan),
    });
  } catch (error) {
    console.error('[cancelSuperAdminAgencyBilling]', error.message);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to cancel',
    });
  }
};

export const expireSuperAdminAgencyBilling = async (req, res) => {
  try {
    const sub = await expireSubscription(req.params.id, {
      actorType: 'superadmin',
      actorId: req.user._id,
      notes: req.body?.notes || '',
    });
    const plan = await Plan.findOne({ code: sub.planCode }).lean();
    res.json({
      success: true,
      message: 'Subscription expired',
      subscription: serializeSubscription(sub, plan),
    });
  } catch (error) {
    console.error('[expireSuperAdminAgencyBilling]', error.message);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to expire',
    });
  }
};

export const getBillingOverview = async (_req, res) => {
  try {
    const AgencySubscription = (await import('../models/AgencySubscription.js')).default;
    const rows = await AgencySubscription.aggregate([
      { $match: { isCurrent: true } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const byStatus = Object.fromEntries(rows.map((r) => [r._id, r.count]));
    res.json({ success: true, byStatus });
  } catch (error) {
    console.error('[getBillingOverview]', error.message);
    res.status(500).json({ success: false, message: 'Failed to load billing overview' });
  }
};

export default {
  listPublicPlans,
  getOwnerBilling,
  cancelOwnerBilling,
  checkoutOwnerBilling,
  getSuperAdminAgencyBilling,
  assignSuperAdminAgencyPlan,
  extendSuperAdminAgencyTrial,
  suspendSuperAdminAgencyBilling,
  reactivateSuperAdminAgencyBilling,
  cancelSuperAdminAgencyBilling,
  expireSuperAdminAgencyBilling,
  getBillingOverview,
};
