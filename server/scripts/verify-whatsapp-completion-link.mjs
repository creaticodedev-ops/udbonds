/**
 * Verifies owner WhatsApp completion flow returns a link without requiring Meta/Twilio API.
 * Run with server stopped — uses services directly.
 */
import mongoose from 'mongoose';
import 'dotenv/config';
import { buildMongoUri } from '../configs/db.js';
import '../models/Car.js';
import '../models/Booking.js';
import Booking from '../models/Booking.js';
import { generateCompletionLink } from '../services/bookingCompletionService.js';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
await mongoose.connect(buildMongoUri(uri));

const booking = await Booking.findOne({ status: { $ne: 'cancelled' } }).sort({ createdAt: -1 });
if (!booking) throw new Error('No booking found');

const { completionUrl } = await generateCompletionLink(booking._id, { resend: true });
if (!completionUrl || !completionUrl.includes('/complete-booking/')) {
  throw new Error(`Invalid completion URL: ${completionUrl}`);
}

console.log(JSON.stringify({ pass: true, bookingId: booking._id.toString(), completionUrl }, null, 2));
await mongoose.disconnect();
