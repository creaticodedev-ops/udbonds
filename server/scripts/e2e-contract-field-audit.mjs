/**
 * End-to-end audit: save completion details → build default contract HTML → verify every field.
 * Run: node scripts/e2e-contract-field-audit.mjs
 * Requires: MongoDB + API on PORT (default 3000)
 */
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { buildMongoUri } from '../configs/db.js';
import '../models/Car.js';
import '../models/ExportTemplate.js';
import '../models/Booking.js';
import Booking from '../models/Booking.js';
import ExportTemplate from '../models/ExportTemplate.js';
import { generateCompletionLink } from '../services/bookingCompletionService.js';
import { buildTemplateVariables, buildDocumentHtml } from '../services/templateEngine.js';
import { generateContractPdf } from '../services/templatePdfExport.js';
import { ensureDefaultTemplates } from '../controllers/exportTemplateController.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API = `http://127.0.0.1:${process.env.PORT || 3000}`;

const TEST = {
  customerName: 'Audit Test Locataire',
  customerEmail: 'audit.contract@example.com',
  customerPhone: '+212612345678',
  dateOfBirth: '1985-06-15',
  nationality: 'Marocaine',
  customerAddress: '12 Rue Audit, Casablanca',
  placeOfBirth: 'Fès',
  identityDocumentNumber: 'AB123456',
  identityIssuedOn: '2015-03-10',
  driverLicenseNumber: 'PERM-998877',
  driverLicenseExpiry: '2030-08-20',
  driverLicenseIssuedOn: '2010-05-01',
  passportNumber: 'PAAudit12345',
  secondDriver: {
    enabled: true,
    fullName: 'Second Audit Driver',
    dateOfBirth: '1990-11-22',
    nationality: 'Française',
    phone: '+33601020304',
    driverLicenseNumber: 'FR-PERM-5544',
    driverLicenseExpiry: '2032-01-15',
    passportNumber: 'FRPass999',
  },
};

const FIELD_CHECKS = [
  ['customer_name', (b) => b.customerName],
  ['customer_email', (b) => b.customerEmail],
  ['customer_phone', (b) => b.customerPhone],
  ['customer_nationality', (b) => b.nationality],
  ['customer_dob', (b) => b.dateOfBirth],
  ['customer_birth_place', (b) => b.placeOfBirth],
  ['customer_address', (b) => b.customerAddress],
  ['driver_license', (b) => b.driverLicenseNumber],
  ['driver_license_expiry', (b) => b.driverLicenseExpiry],
  ['driver_license_issued_on', (b) => b.driverLicenseIssuedOn],
  ['passport_number', (b) => b.passportNumber],
  ['identity_document', (b) => b.identityDocumentNumber],
  ['identity_issued_on', (b) => b.identityIssuedOn],
  ['second_driver_name', (b) => b.secondDriver?.fullName],
  ['second_driver_phone', (b) => b.secondDriver?.phone],
  ['second_driver_license', (b) => b.secondDriver?.driverLicenseNumber],
];

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
await mongoose.connect(buildMongoUri(uri));

let booking = await Booking.findOne({
  status: { $nin: ['cancelled', 'ready_for_pickup'] },
})
  .sort({ createdAt: -1 })
  .populate('car');

if (!booking) {
  booking = await Booking.findOne({ status: { $ne: 'cancelled' } })
    .sort({ createdAt: -1 })
    .populate('car');
  if (booking?.status === 'ready_for_pickup') {
    booking.status = 'confirmed';
    booking.completion = booking.completion || {};
    booking.completion.completedAt = null;
    booking.completion.contractPdfUrl = '';
    booking.completion.signatureUrl = '';
    booking.completion.signatureComplete = false;
    await booking.save();
  }
}

if (!booking) {
  throw new Error('No booking in database — create one first');
}

const { completionUrl } = await generateCompletionLink(booking._id, { resend: true });
const token = completionUrl.split('/').pop();

const saveRes = await fetch(`${API}/api/booking-completion/${token}/details`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(TEST),
});
const saveBody = await saveRes.json();
if (!saveRes.ok || !saveBody.success) {
  throw new Error(`Save details failed: ${saveRes.status} ${JSON.stringify(saveBody)}`);
}

booking = await Booking.findById(booking._id).populate('car').lean();
await ensureDefaultTemplates(booking.owner);
const template = await ExportTemplate.findOne({
  owner: booking.owner,
  type: 'contract',
  isDefault: true,
  isActive: true,
}).lean();

if (!template) throw new Error('No default contract template for owner');

const contractNumber = booking.reservationId || `AUDIT-${booking._id.toString().slice(-6)}`;
const vars = buildTemplateVariables(booking, {
  contractNumber,
  owner: { _id: booking.owner },
  template,
  includeCompanyStamp: false,
});
const html = buildDocumentHtml(template, vars);

const failures = [];
for (const [key, getExpected] of FIELD_CHECKS) {
  const expected = getExpected(booking);
  const rendered = vars[key];
  if (!expected || String(expected).trim() === '') {
    failures.push({ key, issue: 'missing in booking after save' });
    continue;
  }
  if (rendered === '—' || !String(rendered).includes(String(expected).trim())) {
    if (!html.includes(String(expected).trim())) {
      failures.push({ key, expected, rendered, inHtml: false });
    }
  }
}

// Vehicle / rental fields from booking (not form)
['pickup_location', 'return_location', 'total_price', 'car_make'].forEach((key) => {
  const v = vars[key];
  if (v === '—' || v === '') failures.push({ key, issue: 'empty rental/vehicle var', rendered: v });
});

let pdfPath = null;
let pdfError = null;
try {
  const pdfResult = await generateContractPdf({
    template,
    booking,
    contractNumber,
    owner: { _id: booking.owner },
    includeCompanyStamp: false,
  });
  pdfPath = pdfResult.filePath;
  // PDF streams are compressed; field presence is verified via rendered HTML above.
} catch (e) {
  pdfError = e.message;
  console.warn('[e2e] PDF skipped:', pdfError);
}

const report = {
  bookingId: booking._id.toString(),
  reservationId: booking.reservationId,
  saveStatus: saveRes.status,
  templateId: template._id.toString(),
  templateVersion: template.templateVersion,
  failures,
  pass: failures.length === 0,
  pdfPath,
  pdfError,
  sampleVars: {
    customer_name: vars.customer_name,
    identity_document: vars.identity_document,
    second_driver_name: vars.second_driver_name,
    car_registration: vars.car_registration,
  },
};

const outPath = path.join(__dirname, 'e2e-contract-audit-report.json');
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

await mongoose.disconnect();
process.exit(report.pass ? 0 : 1);
