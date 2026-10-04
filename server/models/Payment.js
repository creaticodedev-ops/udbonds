import mongoose from 'mongoose';
import { agencyIdField } from '../utils/tenantScope.js';

const { ObjectId } = mongoose.Schema.Types;

const paymentSchema = new mongoose.Schema({
  booking: { type: ObjectId, ref: 'Booking', required: true },
  /** Canonical tenant key (P1) */
  agencyId: agencyIdField,
  /** Legacy primary owner user id (P0 compat) */
  owner: { type: ObjectId, ref: 'User', index: true, default: null },
  user: { type: ObjectId, ref: 'User', default: null },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  method: { type: String, default: 'offline' },
  status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
  gateway: { type: String, default: 'offline' },
  reference: { type: String, default: '' },
}, { timestamps: true });

paymentSchema.index({ booking: 1 }, { unique: true });

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;
