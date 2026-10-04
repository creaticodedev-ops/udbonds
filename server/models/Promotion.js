import mongoose from 'mongoose';
import { agencyIdField } from '../utils/tenantScope.js';

const { ObjectId } = mongoose.Schema.Types;

/**
 * Agency-scoped promotional offers / promo codes.
 * Discount amounts are always computed server-side at booking time.
 */
const promotionSchema = new mongoose.Schema(
  {
    agencyId: agencyIdField,
    owner: { type: ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', maxlength: 2000 },
    /** Empty = automatic promotion (no code required) */
    code: { type: String, default: '', trim: true, uppercase: true, maxlength: 40 },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: true,
    },
    discountValue: { type: Number, required: true, min: 0 },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    minRentalDays: { type: Number, default: 1, min: 1 },
    maxRentalDays: { type: Number, default: 0, min: 0 }, // 0 = no max
    minBookingAmount: { type: Number, default: 0, min: 0 },
    maxDiscountAmount: { type: Number, default: 0, min: 0 }, // 0 = no cap
    /** Empty arrays = no restriction */
    vehicleCategories: [{ type: String }],
    vehicleModels: [{ type: String }], // "Brand Model" or model only
    globalUsageLimit: { type: Number, default: 0, min: 0 }, // 0 = unlimited
    perCustomerUsageLimit: { type: Number, default: 0, min: 0 }, // 0 = unlimited
    usageCount: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
    /** If false and code is set, only applies when customer enters the code */
    requirePromoCode: { type: Boolean, default: true },
    priority: { type: Number, default: 100 },
    allowStacking: { type: Boolean, default: false },
    occasion: {
      type: String,
      enum: [
        'custom',
        'summer',
        'winter',
        'new_year',
        'ramadan',
        'eid',
        'black_friday',
        'special_event',
        'last_minute',
        'long_stay',
      ],
      default: 'custom',
    },
  },
  { timestamps: true },
);

promotionSchema.index({ owner: 1, code: 1 });
promotionSchema.index({ owner: 1, isActive: 1, startAt: 1, endAt: 1 });
promotionSchema.index({ owner: 1, priority: -1 });

promotionSchema.pre('validate', function preValidate(next) {
  if (this.endAt && this.startAt && this.endAt < this.startAt) {
    this.invalidate('endAt', 'End date must be after start date');
  }
  if (this.discountType === 'percentage' && this.discountValue > 100) {
    this.invalidate('discountValue', 'Percentage discount cannot exceed 100');
  }
  next();
});

const Promotion = mongoose.model('Promotion', promotionSchema);
export default Promotion;
