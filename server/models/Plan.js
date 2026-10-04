import mongoose from 'mongoose';

const featuresSchema = new mongoose.Schema(
  {
    maxVehicles: { type: Number, default: null },
    maxStaff: { type: Number, default: null },
    maxBookingsPerMonth: { type: Number, default: null },
    maxStorageMb: { type: Number, default: null },
    customDomain: { type: Boolean, default: false },
    subdomain: { type: Boolean, default: true },
    whatsappSettings: { type: Boolean, default: true },
    promotions: { type: Boolean, default: false },
    contractsPdf: { type: Boolean, default: true },
    analytics: { type: Boolean, default: false },
    apiAccess: { type: Boolean, default: false },
    prioritySupport: { type: Boolean, default: false },
  },
  { _id: false },
);

/**
 * SaaS plan catalog (P4). Seeded codes are stable API keys.
 */
const planSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    priceAmount: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'MAD', uppercase: true, trim: true },
    interval: { type: String, enum: ['month', 'year'], default: 'month' },
    intervalCount: { type: Number, default: 1, min: 1 },
    trialDaysDefault: { type: Number, default: 0, min: 0 },
    isPublic: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 100 },
    features: { type: featuresSchema, default: () => ({}) },
    stripePriceId: { type: String, default: '', trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const Plan = mongoose.model('Plan', planSchema);
export default Plan;
export { featuresSchema };
