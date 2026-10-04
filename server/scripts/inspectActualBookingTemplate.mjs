import mongoose from 'mongoose';
import { buildMongoUri } from '../configs/db.js';
import '../models/Car.js';
import Booking from '../models/Booking.js';
import ExportTemplate from '../models/ExportTemplate.js';
import { buildTemplateVariables, buildDocumentHtml } from '../services/templateEngine.js';

const ownerId = '6a68cd7069804c8feec7a8d9';
const reservationId = 'RES-8LCFKW4N';

await mongoose.connect(buildMongoUri(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017'));
const booking = await Booking.findOne({ owner: ownerId, reservationId }).populate('car').lean();
const template = await ExportTemplate.findOne({ owner: ownerId, type: 'contract', isDefault: true, isActive: true }).lean();
const vars = buildTemplateVariables(booking, { contractNumber: booking?.reservationId, owner: { _id: ownerId }, template, includeCompanyStamp: false });
const html = buildDocumentHtml(template, vars);

console.log(JSON.stringify({
  reservationId: booking?.reservationId,
  bookingValues: {
    customerName: booking?.customerName,
    customerEmail: booking?.customerEmail,
    customerPhone: booking?.customerPhone,
    dateOfBirth: booking?.dateOfBirth,
    nationality: booking?.nationality,
    customerAddress: booking?.customerAddress,
    placeOfBirth: booking?.placeOfBirth,
    identityDocumentNumber: booking?.identityDocumentNumber,
    driverLicenseNumber: booking?.driverLicenseNumber,
    passportNumber: booking?.passportNumber,
    secondDriverName: booking?.secondDriver?.fullName,
    secondDriverPhone: booking?.secondDriver?.phone,
  },
  templateName: template?.name,
  templateId: template?._id?.toString(),
  vars: {
    customer_name: vars.customer_name,
    customer_dob: vars.customer_dob,
    customer_address: vars.customer_address,
    driver_license: vars.driver_license,
    passport_number: vars.passport_number,
    second_driver_name: vars.second_driver_name,
    second_driver_license: vars.second_driver_license,
    car_registration: vars.car_registration,
    pickup_date: vars.pickup_date,
    total_price: vars.total_price,
  },
  htmlContains: {
    customerName: html.includes(booking?.customerName || ''),
    customerAddress: html.includes(booking?.customerAddress || ''),
    driverLicense: html.includes(booking?.driverLicenseNumber || ''),
    passport: html.includes(booking?.passportNumber || ''),
    secondDriver: html.includes(booking?.secondDriver?.fullName || ''),
  },
}, null, 2));

await mongoose.disconnect();
