import mongoose from 'mongoose';
import { buildMongoUri } from '../configs/db.js';
import '../models/Car.js';
import '../models/ExportTemplate.js';
import '../models/Booking.js';
import Booking from '../models/Booking.js';
import ExportTemplate from '../models/ExportTemplate.js';
import { generateCompletionLink } from '../services/bookingCompletionService.js';
import { buildTemplateVariables, buildDocumentHtml } from '../services/templateEngine.js';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
await mongoose.connect(buildMongoUri(uri));

const booking = await Booking.findOne({ status: { $ne: 'ready_for_pickup' } }).sort({ createdAt: -1 });
if (!booking) {
  throw new Error('No suitable booking found for verification');
}

const { completionUrl } = await generateCompletionLink(booking._id, { resend: false });
const token = completionUrl.split('/').pop();
const payload = {
  customerName: 'Flow Verify User',
  customerEmail: 'flowverify@example.com',
  customerPhone: '+212600000001',
  dateOfBirth: '1990-01-02',
  nationality: 'Moroccan',
  customerAddress: 'Rue Flow Verify',
  placeOfBirth: 'Rabat',
  identityDocumentNumber: 'CIN-FLOW',
  identityIssuedOn: '2010-01-01',
  driverLicenseNumber: 'DL-FLOW',
  driverLicenseExpiry: '2035-01-01',
  driverLicenseIssuedOn: '2010-01-01',
  passportNumber: 'PASS-FLOW',
  secondDriver: {
    enabled: true,
    fullName: 'Second Flow User',
    dateOfBirth: '1992-02-03',
    nationality: 'French',
    phone: '+212611111111',
    driverLicenseNumber: 'DL-2-FLOW',
    driverLicenseExpiry: '2036-02-03',
    passportNumber: 'PASS-2-FLOW',
  },
};

const response = await fetch(`http://localhost:3000/api/booking-completion/${token}/details`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
const body = await response.text();
const updated = await Booking.findById(booking._id).populate('car').lean();
const template = await ExportTemplate.findOne({ owner: updated.owner, type: 'contract', isDefault: true, isActive: true }).lean();
const vars = buildTemplateVariables(updated, { contractNumber: updated.reservationId, owner: { _id: updated.owner }, template, includeCompanyStamp: false });
const html = buildDocumentHtml(template, vars);

console.log(JSON.stringify({
  responseStatus: response.status,
  responseBody: body,
  savedValues: {
    customerName: updated.customerName,
    customerAddress: updated.customerAddress,
    nationality: updated.nationality,
    driverLicenseNumber: updated.driverLicenseNumber,
    passportNumber: updated.passportNumber,
    secondDriverName: updated.secondDriver?.fullName,
    secondDriverPhone: updated.secondDriver?.phone,
  },
  renderedVars: {
    customer_name: vars.customer_name,
    customer_address: vars.customer_address,
    driver_license: vars.driver_license,
    passport_number: vars.passport_number,
    second_driver_name: vars.second_driver_name,
    second_driver_license: vars.second_driver_license,
    total_price: vars.total_price,
  },
  htmlContains: {
    customerName: html.includes(updated.customerName || ''),
    customerAddress: html.includes(updated.customerAddress || ''),
    driverLicense: html.includes(updated.driverLicenseNumber || ''),
    passport: html.includes(updated.passportNumber || ''),
    secondDriver: html.includes(updated.secondDriver?.fullName || ''),
  },
}, null, 2));

await mongoose.disconnect();
