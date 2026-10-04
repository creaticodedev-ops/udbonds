import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const platformNotificationSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ['agency', 'users', 'system', 'subscription'],
      required: true,
      index: true,
    },
    type: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    body: { type: String, default: '', trim: true, maxlength: 400 },
    href: { type: String, default: '', trim: true, maxlength: 240 },
    agencyId: { type: ObjectId, ref: 'Agency', default: null, index: true },
    agencyName: { type: String, default: '', trim: true },
    severity: {
      type: String,
      enum: ['info', 'warn', 'critical'],
      default: 'info',
      index: true,
    },
    readAt: { type: Date, default: null, index: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

platformNotificationSchema.index({ createdAt: -1 });
platformNotificationSchema.index({ readAt: 1, createdAt: -1 });

const PlatformNotification = mongoose.model('PlatformNotification', platformNotificationSchema);
export default PlatformNotification;
