import mongoose from 'mongoose';
import { agencyIdField } from '../utils/tenantScope.js';

const { ObjectId } = mongoose.Schema.Types;

/**
 * Atomic per-customer promotion usage counter (agency-scoped).
 * Used to enforce perCustomerUsageLimit under concurrent booking requests.
 */
const promotionCustomerUsageSchema = new mongoose.Schema(
  {
    agencyId: agencyIdField,
    owner: { type: ObjectId, ref: 'User', required: true, index: true },
    promotion: { type: ObjectId, ref: 'Promotion', required: true },
    customerEmail: { type: String, required: true, lowercase: true, trim: true },
    usageCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

promotionCustomerUsageSchema.index(
  { promotion: 1, customerEmail: 1 },
  { unique: true },
);

const PromotionCustomerUsage = mongoose.model(
  'PromotionCustomerUsage',
  promotionCustomerUsageSchema,
);

export default PromotionCustomerUsage;
