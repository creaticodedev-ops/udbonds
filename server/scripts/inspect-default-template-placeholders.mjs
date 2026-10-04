import mongoose from 'mongoose';
import { buildMongoUri } from '../configs/db.js';
import '../models/Car.js';
import '../models/ExportTemplate.js';
import '../models/Booking.js';
import ExportTemplate from '../models/ExportTemplate.js';
import Booking from '../models/Booking.js';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
await mongoose.connect(buildMongoUri(uri));

const booking = await Booking.findOne({ reservationId: 'RES-4PRVDCFL' }).populate('car').lean();
const template = await ExportTemplate.findOne({ owner: booking?.owner, type: 'contract', isDefault: true, isActive: true }).lean();

const placeholderRegex = /\{\{\s*([^{}]+?)\s*\}\}/g;
const placeholders = new Set();
for (const part of [template?.headerHtml || '', template?.bodyHtml || '', template?.footerHtml || '']) {
  for (const match of part.matchAll(placeholderRegex)) placeholders.add(match[1].trim());
}

console.log(JSON.stringify({
  reservationId: booking?.reservationId,
  templateName: template?.name,
  templateId: template?._id?.toString(),
  placeholders: Array.from(placeholders).sort(),
}, null, 2));

await mongoose.disconnect();
