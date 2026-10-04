/**
 * End-to-end: pending booking → ensure link → token persisted → token lookup works.
 * Usage: node server/scripts/verify-completion-link-flow.mjs
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { default: Booking } = await import('../models/Booking.js');
await import('../models/Car.js');
const {
  ensureBookingCompletionLink,
  findBookingByCompletionToken,
} = await import('../services/bookingCompletionService.js');
const { hashToken } = await import('../services/completionToken.js');

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!uri) {
  console.error('MONGODB_URI not set — skip live test');
  process.exit(0);
}

await mongoose.connect(uri);

const pending = await Booking.findOne({ status: 'pending' }).sort({ createdAt: -1 });
if (!pending) {
  console.log('No pending booking in DB — creating ephemeral test skipped (no car context).');
  await mongoose.disconnect();
  process.exit(0);
}

console.log('Testing booking', pending.reservationId || pending._id, 'status=', pending.status);

const beforeHash = pending.completion?.tokenHash || '';
const beforeUrl = pending.completion?.shareableCompletionUrl || '';

const result = await ensureBookingCompletionLink(pending._id, { refresh: !beforeUrl || !beforeHash });
console.log('ensure:', { created: result.created, url: result.completionUrl?.slice(0, 60) + '…' });

const reloaded = await Booking.findById(pending._id).lean();
const tokenHash = reloaded.completion?.tokenHash;
const url = reloaded.completion?.shareableCompletionUrl;

if (!tokenHash) {
  console.error('FAIL: completion.tokenHash not persisted');
  process.exit(1);
}
if (!url || !url.includes('/complete-booking/')) {
  console.error('FAIL: shareableCompletionUrl missing or invalid');
  process.exit(1);
}

const rawToken = url.split('/').pop();
const found = await findBookingByCompletionToken(rawToken);
if (!found || found._id.toString() !== pending._id.toString()) {
  console.error('FAIL: token lookup did not resolve booking');
  process.exit(1);
}

if (hashToken(rawToken) !== tokenHash) {
  console.error('FAIL: stored hash mismatch');
  process.exit(1);
}

console.log('OK: link persisted, tokenHash saved, lookup works, status=', reloaded.status);
await mongoose.disconnect();
