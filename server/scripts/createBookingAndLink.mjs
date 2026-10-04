import mongoose from 'mongoose';
import { buildMongoUri } from '../configs/db.js';
import '../models/Car.js';
import '../models/User.js';
import Booking from '../models/Booking.js';
import { generateCompletionLink } from '../services/bookingCompletionService.js';

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
await mongoose.connect(buildMongoUri(mongoUri));

const bookingPayload = {
  car: '6a6bf339ab432b5c456d32dd',
  pickupDate: '2030-02-01',
  returnDate: '2030-02-05',
  fullName: 'E2E Contract Tester',
  email: 'contract-e2e@example.com',
  phone: '+212600000111',
  pickupLocation: 'Casablanca',
  returnLocation: 'Rabat',
  notes: 'Contract placeholder verification',
};

const res = await fetch('http://localhost:3000/api/bookings/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(bookingPayload),
});
const body = await res.text();
console.log('create status', res.status);
console.log(body);
if (!res.ok) process.exit(1);
const created = JSON.parse(body);
const booking = await Booking.findOne({ reservationId: created.reservationId }).lean();
if (!booking) throw new Error('Booking not found after create');
const linkResult = await generateCompletionLink(booking._id, { resend: false });
console.log(JSON.stringify({ reservationId: booking.reservationId, bookingId: booking._id.toString(), completionUrl: linkResult.completionUrl }, null, 2));
await mongoose.disconnect();
