import mongoose from 'mongoose';
import { buildMongoUri } from '../configs/db.js';
import '../models/Car.js';
import Booking from '../models/Booking.js';
import { generateCompletionLink } from '../services/bookingCompletionService.js';

await mongoose.connect(buildMongoUri(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017'));
const booking = await Booking.findOne({ status: { $ne: 'ready_for_pickup' } }).sort({ createdAt: -1 });
if (!booking) throw new Error('No booking found');
const { completionUrl } = await generateCompletionLink(booking._id, { resend: false });
const token = completionUrl.split('/').pop();
const payload = {
  customerName: 'Repro Customer',
  customerEmail: 'repro@example.com',
  customerPhone: '+212600000000',
  dateOfBirth: '1990-01-01',
  nationality: 'Moroccan',
  customerAddress: 'Rue de Repro',
  placeOfBirth: 'Casablanca',
  identityDocumentNumber: 'CIN-REPRO',
  identityIssuedOn: '2018-01-01',
  driverLicenseNumber: 'DL-REPRO',
  driverLicenseExpiry: '2035-01-01',
  driverLicenseIssuedOn: '2020-01-01',
  passportNumber: 'PASS-REPRO',
  secondDriver: {
    enabled: true,
    fullName: 'Second Repro',
    dateOfBirth: '1992-02-02',
    nationality: 'French',
    phone: '+212611111111',
    driverLicenseNumber: 'DL-2',
    driverLicenseExpiry: '2036-02-02',
    passportNumber: 'PASS-2',
  },
};
const res = await fetch(`http://localhost:3000/api/booking-completion/${token}/details`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
console.log('status', res.status);
const body = await res.text();
console.log(body);
const fresh = await Booking.findById(booking._id).lean();
console.log(JSON.stringify({
  customerName: fresh.customerName,
  customerEmail: fresh.customerEmail,
  customerPhone: fresh.customerPhone,
  dateOfBirth: fresh.dateOfBirth,
  nationality: fresh.nationality,
  customerAddress: fresh.customerAddress,
  placeOfBirth: fresh.placeOfBirth,
  identityDocumentNumber: fresh.identityDocumentNumber,
  driverLicenseNumber: fresh.driverLicenseNumber,
  passportNumber: fresh.passportNumber,
  secondDriver: fresh.secondDriver,
}, null, 2));
await mongoose.disconnect();
