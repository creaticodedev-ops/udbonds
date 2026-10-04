import mongoose from 'mongoose';
import { buildMongoUri } from '../configs/db.js';
import Booking from '../models/Booking.js';
import Car from '../models/Car.js';
import User from '../models/User.js';
import ExportTemplate from '../models/ExportTemplate.js';
import { generateCompletionLink } from '../services/bookingCompletionService.js';
import { buildTemplateVariables, renderTemplate } from '../services/templateEngine.js';

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
await mongoose.connect(buildMongoUri(mongoUri));

const carId = '6a6bf339ab432b5c456d32dd';
const bookingPayload = {
  car: carId,
  pickupDate: '2030-01-01',
  returnDate: '2030-01-05',
  fullName: 'E2E Contract Tester',
  email: 'contract-e2e@example.com',
  phone: '+212600000111',
  pickupLocation: 'Casablanca',
  returnLocation: 'Rabat',
  notes: 'Contract placeholder verification',
};

const createRes = await fetch(`http://localhost:3000/api/bookings/create`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(bookingPayload),
});
const createBody = await createRes.text();
console.log('create booking status', createRes.status);
console.log(createBody);
const created = JSON.parse(createBody);
const booking = await Booking.findOne({ reservationId: created.reservationId }).lean();
if (!booking) throw new Error('Booking not found');

const linkResult = await generateCompletionLink(booking._id, { resend: false });
const token = linkResult.completionUrl.split('/').pop();

const detailPayload = {
  customerName: 'Alice Johnson',
  customerEmail: 'alice@example.com',
  customerPhone: '+212611223344',
  dateOfBirth: '1990-04-20',
  nationality: 'Moroccan',
  customerAddress: '12 Rue de la Paix, Casablanca',
  placeOfBirth: 'Marrakech',
  identityDocumentNumber: 'CIN-1001',
  identityIssuedOn: '2015-05-10',
  driverLicenseNumber: 'DL-7777',
  driverLicenseExpiry: '2035-06-30',
  driverLicenseIssuedOn: '2012-06-30',
  passportNumber: 'P-4444',
  secondDriver: {
    enabled: true,
    fullName: 'Bob Johnson',
    dateOfBirth: '1992-07-15',
    nationality: 'French',
    phone: '+33612345678',
    driverLicenseNumber: 'FR-8888',
    driverLicenseExpiry: '2036-08-20',
    passportNumber: 'FR-7777',
  },
};

const detailsRes = await fetch(`http://localhost:3000/api/booking-completion/${token}/details`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(detailPayload),
});
const detailsBody = await detailsRes.text();
console.log('details status', detailsRes.status);
console.log(detailsBody);

const updatedBooking = await Booking.findById(booking._id).populate('car').populate('owner').lean();
const template = await ExportTemplate.findOne({ owner: updatedBooking.owner?._id || updatedBooking.owner, type: 'contract', systemKey: 'builtin_contract' }).lean();
const variables = buildTemplateVariables(updatedBooking, { contractNumber: updatedBooking.reservationId, owner: updatedBooking.owner, template, includeCompanyStamp: false });
const renderedBody = renderTemplate(template?.bodyHtml || '', variables);

const placeholderChecks = [
  ['customer_name', variables.customer_name],
  ['customer_dob', variables.customer_dob],
  ['customer_birth_place', variables.customer_birth_place],
  ['identity_document', variables.identity_document],
  ['identity_issued_on', variables.identity_issued_on],
  ['driver_license', variables.driver_license],
  ['driver_license_issued_on', variables.driver_license_issued_on],
  ['customer_address', variables.customer_address],
  ['customer_phone', variables.customer_phone],
  ['customer_email', variables.customer_email],
  ['customer_nationality', variables.customer_nationality],
  ['car_make', variables.car_make],
  ['car_registration', variables.car_registration],
  ['car_category', variables.car_category],
  ['car_year', variables.car_year],
  ['delivered_by', variables.delivered_by],
  ['received_by', variables.received_by],
  ['pickup_date', variables.pickup_date],
  ['return_date', variables.return_date],
  ['rental_days', variables.rental_days],
  ['pickup_location', variables.pickup_location],
  ['return_location', variables.return_location],
  ['fuel_level_start', variables.fuel_level_start],
  ['km_depart', variables.km_depart],
  ['km_retour', variables.km_retour],
  ['price_per_day', variables.price_per_day],
  ['total_price', variables.total_price],
  ['franchise_amount', variables.franchise_amount],
  ['payment_status', variables.payment_status],
  ['second_driver_section', variables.second_driver_section],
  ['second_driver_name', variables.second_driver_name],
];

const failures = placeholderChecks.filter(([, value]) => value === '—' || value === '' || value === undefined || value === null);
const renderedMissing = Array.from(new Set([
  ...placeholderChecks.filter(([, value]) => value === '—' || value === '' || value === undefined || value === null).map(([key]) => key),
  ...Array.from(renderedBody.matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi)).map((m) => m[1].toLowerCase()),
])).filter(Boolean);

console.log(JSON.stringify({ reservationId: updatedBooking.reservationId, templateName: template?.name, failures, renderedMissing, values: Object.fromEntries(placeholderChecks) }, null, 2));

await mongoose.disconnect();
if (failures.length > 0) {
  process.exit(1);
}
