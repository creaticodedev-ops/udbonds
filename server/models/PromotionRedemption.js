import mongoose from 'mongoose';
import { agencyIdField } from '../utils/tenantScope.js';

const { ObjectId } = mongoose.Schema.Types;

/** Tracks per-booking promo usage for limits / audit. */
const promotionRedemptionSchema = new mongoose.Schema(
  {
    agencyId: agencyIdField,
    owner: { type: ObjectId, ref: 'User', required: true, index: true },
    promotion: { type: ObjectId, ref: 'Promotion', required: true, index: true },
    booking: { type: ObjectId, ref: 'Booking', required: true, index: true },
    customerEmail: { type: String, default: '', lowercase: true, trim: true, index: true },
    customerPhone: { type: String, default: '', trim: true },
    code: { type: String, default: '' },
    discountAmount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

/** One redemption row per promotion applied on a booking (supports stacking). */
promotionRedemptionSchema.index({ booking: 1, promotion: 1 }, { unique: true });
promotionRedemptionSchema.index({ owner: 1, promotion: 1, customerEmail: 1 });

const PromotionRedemption = mongoose.model('PromotionRedemption', promotionRedemptionSchema);
export default PromotionRedemption;
