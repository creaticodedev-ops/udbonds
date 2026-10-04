import mongoose from 'mongoose';
import Agency from '../models/Agency.js';
import User from '../models/User.js';
import Car from '../models/Car.js';
import Booking from '../models/Booking.js';
import PickupLocation from '../models/PickupLocation.js';
import Payment from '../models/Payment.js';
import GuestCustomer from '../models/GuestCustomer.js';
import Contract from '../models/Contract.js';
import Invoice from '../models/Invoice.js';
import ExportTemplate from '../models/ExportTemplate.js';
import AgencySettings from '../models/AgencySettings.js';
import Promotion from '../models/Promotion.js';
import PromotionRedemption from '../models/PromotionRedemption.js';
import PromotionCustomerUsage from '../models/PromotionCustomerUsage.js';
import MaintenanceRecord from '../models/MaintenanceRecord.js';
import CarModelOrder from '../models/CarModelOrder.js';
import AdminNotification from '../models/AdminNotification.js';
import AuditLog from '../models/AuditLog.js';
import DocumentRevision from '../models/DocumentRevision.js';
import { clearPublicTenantCache } from './publicTenant.js';

const BUSINESS_MODELS = [
  { name: 'Car', model: Car },
  { name: 'Booking', model: Booking },
  { name: 'PickupLocation', model: PickupLocation },
  { name: 'Payment', model: Payment },
  { name: 'GuestCustomer', model: GuestCustomer },
  { name: 'Contract', model: Contract },
  { name: 'Invoice', model: Invoice },
  { name: 'ExportTemplate', model: ExportTemplate },
  { name: 'AgencySettings', model: AgencySettings },
  { name: 'Promotion', model: Promotion },
  { name: 'PromotionRedemption', model: PromotionRedemption },
  { name: 'PromotionCustomerUsage', model: PromotionCustomerUsage },
  { name: 'MaintenanceRecord', model: MaintenanceRecord },
  { name: 'CarModelOrder', model: CarModelOrder },
  { name: 'AdminNotification', model: AdminNotification },
  { name: 'AuditLog', model: AuditLog },
  { name: 'DocumentRevision', model: DocumentRevision },
];

const missingAgencyFilter = {
  $or: [{ agencyId: null }, { agencyId: { $exists: false } }],
};

const mapAccountStatusToAgencyStatus = (accountStatus) => {
  if (accountStatus === 'pending') return 'pending';
  if (accountStatus === 'suspended') return 'suspended';
  if (accountStatus === 'disabled') return 'disabled';
  return 'active';
};

/**
 * Create or return the Agency for a single owner user. Never deletes data.
 * @param {import('mongoose').Document|object} ownerUser
 */
export const ensureAgencyForOwner = async (ownerUser) => {
  if (!ownerUser?._id) return null;

  if (ownerUser.agencyId) {
    const existing = await Agency.findById(ownerUser.agencyId);
    if (existing) return existing.toObject ? existing.toObject() : existing;
  }

  const byLegacy = await Agency.findOne({ legacyOwnerId: ownerUser._id });
  if (byLegacy) {
    if (String(ownerUser.agencyId || '') !== String(byLegacy._id)) {
      await User.updateOne({ _id: ownerUser._id }, { $set: { agencyId: byLegacy._id } });
    }
    return byLegacy.toObject ? byLegacy.toObject() : byLegacy;
  }

  const name =
    String(ownerUser.agencyName || '').trim() ||
    String(ownerUser.name || '').trim() ||
    String(ownerUser.email || 'Agency').split('@')[0];

  const slug = await Agency.ensureUniqueSlug(name);
  const agency = await Agency.create({
    name,
    slug,
    status: mapAccountStatusToAgencyStatus(ownerUser.accountStatus),
    primaryOwnerUserId: ownerUser._id,
    legacyOwnerId: ownerUser._id,
    isPublicStorefront: false,
    logoUrl: ownerUser.image || '',
  });

  await User.updateOne({ _id: ownerUser._id }, { $set: { agencyId: agency._id } });
  return agency.toObject ? agency.toObject() : agency;
};

/**
 * Mark exactly one public storefront agency when possible.
 * Non-destructive: only sets flags, never deletes.
 * Single active agency → auto-flagged (no PUBLIC_AGENCY_ID required).
 */
const assignPublicStorefront = async (ownerToAgency) => {
  const already = await Agency.countDocuments({ isPublicStorefront: true });
  if (already === 1) return;

  if (already > 1) {
    // Keep the oldest flagged agency as public; clear the rest.
    const publics = await Agency.find({ isPublicStorefront: true }).sort({ createdAt: 1 }).select('_id');
    const keep = publics[0]?._id;
    if (keep) {
      await Agency.updateMany({ _id: { $ne: keep }, isPublicStorefront: true }, { $set: { isPublicStorefront: false } });
    }
    return;
  }

  const envAgency = String(process.env.PUBLIC_AGENCY_ID || '').trim();
  if (envAgency && mongoose.isValidObjectId(envAgency)) {
    const exists = await Agency.findById(envAgency).select('_id').lean();
    if (exists) {
      await Agency.updateOne({ _id: exists._id }, { $set: { isPublicStorefront: true } });
      return;
    }
  }

  const envOwner = String(process.env.PUBLIC_OWNER_ID || '').trim();
  if (envOwner && mongoose.isValidObjectId(envOwner) && ownerToAgency.has(envOwner)) {
    await Agency.updateOne(
      { _id: ownerToAgency.get(envOwner) },
      { $set: { isPublicStorefront: true } },
    );
    return;
  }

  // Automatic single-agency deploy: no env vars required
  const active = await Agency.find({ status: 'active' }).select('_id').limit(2).lean();
  if (active.length === 1) {
    await Agency.updateOne({ _id: active[0]._id }, { $set: { isPublicStorefront: true } });
  }
};

const backfillModelForOwner = async (Model, ownerId, agencyId) => {
  const result = await Model.updateMany(
    { owner: ownerId, ...missingAgencyFilter },
    { $set: { agencyId } },
  );
  return result.modifiedCount || 0;
};

/**
 * Backfill Payment.agencyId from booking when owner is missing.
 */
const backfillPaymentsFromBookings = async () => {
  const orphanPayments = await Payment.find({
    ...missingAgencyFilter,
  })
    .select('_id booking owner')
    .limit(5000)
    .lean();

  let updated = 0;
  for (const pay of orphanPayments) {
    if (!pay.booking) continue;
    const booking = await Booking.findById(pay.booking).select('owner agencyId').lean();
    if (!booking) continue;
    const set = {};
    if (booking.agencyId) set.agencyId = booking.agencyId;
    if (!pay.owner && booking.owner) set.owner = booking.owner;
    if (!Object.keys(set).length) continue;
    await Payment.updateOne({ _id: pay._id }, { $set: set });
    updated += 1;
  }
  return updated;
};

/**
 * Idempotent, non-destructive Agency migration.
 * - Creates Agency per owner
 * - Links User.agencyId
 * - Stamps agencyId on business docs (never deletes)
 */
export const runAgencyMigration = async ({ dryRun = false } = {}) => {
  const summary = {
    ownersProcessed: 0,
    agenciesCreated: 0,
    agenciesReused: 0,
    usersLinked: 0,
    docsUpdated: {},
    paymentsBackfilled: 0,
    missingAfter: {},
    dryRun,
  };

  const owners = await User.find({ role: 'owner' }).select(
    '_id name email agencyName accountStatus agencyId image',
  );
  summary.ownersProcessed = owners.length;

  if (dryRun) {
    console.log(`[agencyMigration] dry-run: would process ${owners.length} owner(s)`);
    return summary;
  }

  const ownerToAgency = new Map();

  for (const owner of owners) {
    const before = await Agency.findOne({ legacyOwnerId: owner._id }).select('_id');
    const agency = await ensureAgencyForOwner(owner);
    if (!agency) continue;
    ownerToAgency.set(String(owner._id), agency._id);
    if (before) summary.agenciesReused += 1;
    else summary.agenciesCreated += 1;
    if (!owner.agencyId || String(owner.agencyId) !== String(agency._id)) {
      summary.usersLinked += 1;
    }
  }

  await assignPublicStorefront(ownerToAgency);

  for (const { name, model } of BUSINESS_MODELS) {
    let total = 0;
    for (const [ownerId, agencyId] of ownerToAgency.entries()) {
      total += await backfillModelForOwner(model, ownerId, agencyId);
    }
    summary.docsUpdated[name] = total;
  }

  summary.paymentsBackfilled = await backfillPaymentsFromBookings();

  for (const { name, model } of BUSINESS_MODELS) {
    // Count rows that still lack agencyId but have an owner (actionable gaps)
    summary.missingAfter[name] = await model.countDocuments({
      ...missingAgencyFilter,
      owner: { $ne: null },
    });
  }

  clearPublicTenantCache();

  const missingTotal = Object.values(summary.missingAfter).reduce((a, b) => a + b, 0);
  console.log(
    `[agencyMigration] done: owners=${summary.ownersProcessed} created=${summary.agenciesCreated} ` +
      `reused=${summary.agenciesReused} linkedUsers=${summary.usersLinked} ` +
      `paymentFix=${summary.paymentsBackfilled} missingWithOwner=${missingTotal}`,
  );
  if (missingTotal > 0) {
    console.warn('[agencyMigration] some docs still missing agencyId:', summary.missingAfter);
  }

  return summary;
};

export default {
  runAgencyMigration,
  ensureAgencyForOwner,
};
