import mongoose from 'mongoose';
import { featuresSchema } from './Plan.js';

const { ObjectId } = mongoose.Schema.Types;

export const SUBSCRIPTION_STATUSES = [
  'trialing',
  'active',
  'past_due',
  'canceled',
  'expired',
  'suspended',
];

/**
 * Current SaaS subscription for one Agency (canonical tenant key = agencyId).
 */
const agencySubscriptionSchema = new mongoose.Schema(
  {
    agencyId: {
      type: ObjectId,
      ref: 'Agency',
      required: true,
    },
    planCode: { type: String, required: true, lowercase: true, trim: true, index: true },
    status: {
      type: String,
      enum: SUBSCRIPTION_STATUSES,
      default: 'trialing',
      index: true,
    },
    provider: {
      type: String,
      enum: ['manual', 'stripe'],
      default: 'manual',
    },
    providerCustomerId: { type: String, default: '' },
    providerSubscriptionId: { type: String, default: '' },
    providerPriceId: { type: String, default: '' },
    trialStartedAt: { type: Date, default: null },
    trialEndsAt: { type: Date, default: null },
    currentPeriodStart: { type: Date, default: null },
    currentPeriodEnd: { type: Date, default: null },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    canceledAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    graceEndsAt: { type: Date, default: null },
    limitsSnapshot: { type: featuresSchema, default: () => ({}) },
    notes: { type: String, default: '', trim: true },
    createdBySuperAdminId: { type: ObjectId, ref: 'User', default: null },
    isCurrent: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

agencySubscriptionSchema.index(
  { agencyId: 1 },
  {
    unique: true,
    partialFilterExpression: { isCurrent: true },
  },
);

const AgencySubscription = mongoose.model('AgencySubscription', agencySubscriptionSchema);
export default AgencySubscription;
