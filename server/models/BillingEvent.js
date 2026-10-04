import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const billingEventSchema = new mongoose.Schema(
  {
    agencyId: { type: ObjectId, ref: 'Agency', required: true, index: true },
    actorType: {
      type: String,
      enum: ['superadmin', 'owner', 'system', 'webhook'],
      default: 'system',
    },
    actorId: { type: ObjectId, ref: 'User', default: null },
    type: { type: String, required: true, trim: true, index: true },
    from: { type: mongoose.Schema.Types.Mixed, default: null },
    to: { type: mongoose.Schema.Types.Mixed, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    idempotencyKey: { type: String, sparse: true, unique: true },
  },
  { timestamps: true },
);

billingEventSchema.index({ agencyId: 1, createdAt: -1 });

const BillingEvent = mongoose.model('BillingEvent', billingEventSchema);
export default BillingEvent;
