import mongoose from 'mongoose';
import { agencyIdField } from '../utils/tenantScope.js';
const { ObjectId } = mongoose.Schema.Types;

const notificationSchema = new mongoose.Schema({
  agencyId: agencyIdField,
  owner: { type: ObjectId, ref: 'User', required: true, index: true },
  type: {
    type: String,
    enum: [
      'new_reservation',
      'upcoming_pickup',
      'upcoming_return',
      'overdue',
      'maintenance',
      'document_expiry',
      'system',
    ],
    default: 'system',
  },
  title: { type: String, required: true },
  message: { type: String, default: '' },
  link: { type: String, default: '/owner/manage-bookings' },
  isRead: { type: Boolean, default: false },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

notificationSchema.index({ owner: 1, isRead: 1, createdAt: -1 });

const AdminNotification = mongoose.model('AdminNotification', notificationSchema);
export default AdminNotification;
