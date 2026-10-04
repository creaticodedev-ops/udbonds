import mongoose from 'mongoose';
import { agencyIdField } from '../utils/tenantScope.js';
const { ObjectId } = mongoose.Schema.Types;

const internalNoteSchema = new mongoose.Schema({
  text: { type: String, required: true },
  rating: { type: Number, min: 1, max: 5, default: null },
  booking: { type: ObjectId, ref: 'Booking', default: null },
  createdBy: { type: ObjectId, ref: 'User', default: null },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const guestCustomerSchema = new mongoose.Schema({
  agencyId: agencyIdField,
  owner: { type: ObjectId, ref: 'User', required: true, index: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  name: { type: String, default: '' },
  phone: { type: String, default: '' },
  city: { type: String, default: '' },
  status: {
    type: String,
    enum: ['new', 'regular', 'vip', 'blacklisted'],
    default: 'new',
  },
  rating: { type: Number, min: 0, max: 5, default: 0 },
  ratingCount: { type: Number, default: 0 },
  internalNotes: [internalNoteSchema],
  totalReservations: { type: Number, default: 0 },
  completedReservations: { type: Number, default: 0 },
  cancelledReservations: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },
  lastBookingAt: { type: Date, default: null },
  blacklistReason: { type: String, default: '' },
}, { timestamps: true });

guestCustomerSchema.index({ owner: 1, email: 1 }, { unique: true });
guestCustomerSchema.index({ owner: 1, status: 1 });
guestCustomerSchema.index({ owner: 1, rating: -1 });

const GuestCustomer = mongoose.model('GuestCustomer', guestCustomerSchema);
export default GuestCustomer;
