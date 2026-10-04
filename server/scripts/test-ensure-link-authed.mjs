/**
 * Owner login + ensure-link against running API.
 * Usage: node server/scripts/test-ensure-link-authed.mjs
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const API = 'http://127.0.0.1:3000';
const email = process.env.ADMIN_EMAIL || 'admin@americonfort.com';
const password = process.env.ADMIN_PASSWORD || 'Admin123!';

const loginRes = await fetch(`${API}/api/user/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const login = await loginRes.json();
if (!login.success || !login.token) {
  console.error('Login failed', login);
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);
const { default: Booking } = await import('../models/Booking.js');
const booking = await Booking.findOne({ status: { $in: ['pending', 'confirmed'] } }).sort({ createdAt: -1 });
await mongoose.disconnect();
if (!booking) {
  console.error('No booking to test');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${login.token}`,
};

for (const p of [
  '/api/booking-completion/owner/ensure-link',
  '/api/bookings/owner/completion/ensure-link',
]) {
  const res = await fetch(`${API}${p}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ bookingId: booking._id.toString() }),
  });
  const data = await res.json();
  console.log(p, res.status, data.success, data.completionUrl?.slice(0, 55) || data.message);
}
