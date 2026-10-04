import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const bookingSettingsSchema = new mongoose.Schema(
  {
    minRentalDays: { type: Number, default: 1, min: 1, max: 365 },
    maxRentalDays: { type: Number, default: 90, min: 1, max: 730 },
    /** How far ahead customers may book (days from now). */
    advanceBookingDays: { type: Number, default: 365, min: 1, max: 1095 },
    cancellationPolicyText: { type: String, default: '', maxlength: 5000 },
    cancellationFeeType: {
      type: String,
      enum: ['none', 'fixed', 'percent'],
      default: 'none',
    },
    cancellationFeeValue: { type: Number, default: 0, min: 0 },
    /** Default security deposit hint (MAD). Per-car securityDeposit still wins on booking. */
    securityDepositDefault: { type: Number, default: 0, min: 0 },
    extraDriverAllowed: { type: Boolean, default: true },
    extraDriverFeePerDay: { type: Number, default: 0, min: 0 },
    mileageMode: {
      type: String,
      enum: ['unlimited', 'limited'],
      default: 'unlimited',
    },
    mileageLimitKmPerDay: { type: Number, default: 250, min: 0 },
    pickupHoursStart: { type: String, default: '08:00' },
    pickupHoursEnd: { type: String, default: '20:00' },
    returnHoursStart: { type: String, default: '08:00' },
    returnHoursEnd: { type: String, default: '20:00' },
    /** Auto-cancel pending reservations after N hours (0 = disabled). */
    pendingReservationExpiryHours: { type: Number, default: 48, min: 0, max: 720 },
  },
  { _id: false },
);

/**
 * Per-agency runtime settings.
 * agencyId is canonical (P1); owner kept for dual-write / migration compat.
 */
const agencySettingsSchema = new mongoose.Schema(
  {
    agencyId: {
      type: ObjectId,
      ref: 'Agency',
      default: null,
      index: true,
      // unique sparse so multiple nulls allowed until backfill completes
      sparse: true,
      unique: true,
    },
    owner: {
      type: ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    whatsappReservationNumber: { type: String, default: '' },
    whatsappConfirmationNumber: { type: String, default: '' },
    bookingSettings: { type: bookingSettingsSchema, default: () => ({}) },
  },
  { timestamps: true },
);

const AgencySettings = mongoose.model('AgencySettings', agencySettingsSchema);
export default AgencySettings;
