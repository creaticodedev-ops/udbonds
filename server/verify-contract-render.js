import mongoose from 'mongoose';
import { buildMongoUri } from './configs/db.js';
import './models/Car.js';
import Booking from './models/Booking.js';
import ExportTemplate from './models/ExportTemplate.js';
import { generateCompletionLink } from './services/bookingCompletionService.js';
import { ensureDefaultTemplates } from './controllers/exportTemplateController.js';
import { buildTemplateVariables, renderTemplate, buildDocumentHtml } from './services/templateEngine.js';

const run = async () => {
  await mongoose.connect(buildMongoUri(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017'));
  const booking = await Booking.findOne({ reservationId: 'RES-8LCFKW4N' }).populate('car');
  if (!booking) throw new Error('Booking not found');

  // Ensure default templates exist for this owner
  console.log('Ensuring default templates for owner:', booking.owner);
  await ensureDefaultTemplates(booking.owner);

  const { completionUrl } = await generateCompletionLink(booking._id, { resend: false });
  const token = completionUrl.split('/').pop();
  const payload = {
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

  const res = await fetch(`http://localhost:3000/api/booking-completion/${token}/details`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.text();
  console.log('endpoint status', res.status);
  console.log(body);

  const refreshed = await Booking.findById(booking._id).populate('car').lean();
  
  // Get template and verify it exists
  const template = await ExportTemplate.findOne({ owner: refreshed.owner, type: 'contract', systemKey: 'builtin_contract' }).lean();
  console.log('Template found:', !!template, template ? { name: template.name, hasBodyHtml: !!template.bodyHtml, bodyLength: template.bodyHtml?.length } : null);
  
  const vars = buildTemplateVariables(refreshed, { contractNumber: refreshed.reservationId, owner: { _id: refreshed.owner }, template, includeCompanyStamp: false });
  const fullHtml = buildDocumentHtml(template, vars);

  const placeholders = [
    'customer_name','customer_dob','customer_birth_place','customer_address','customer_phone','customer_email','customer_nationality',
    'driver_license','driver_license_expiry','driver_license_issued_on','passport_number','identity_document','identity_issued_on',
    'car_make','car_registration','pickup_date','return_date','pickup_location','return_location','rental_days','price_per_day','total_price',
    'franchise_amount','payment_status','second_driver_name','second_driver_nationality','second_driver_license','second_driver_phone'
  ];
  const missing = placeholders.filter((key) => !vars[key] || vars[key] === '—' || vars[key] === '' || vars[key] === undefined || vars[key] === null);

  console.log(JSON.stringify({
    reservationId: refreshed.reservationId,
    templateInfo: {
      found: !!template,
      bodyHtmlLength: template?.bodyHtml?.length || 0,
      headerHtmlLength: template?.headerHtml?.length || 0,
      footerHtmlLength: template?.footerHtml?.length || 0,
    },
    persisted: {
      customerName: refreshed.customerName,
      dateOfBirth: refreshed.dateOfBirth,
      customerAddress: refreshed.customerAddress,
      driverLicenseNumber: refreshed.driverLicenseNumber,
      passportNumber: refreshed.passportNumber,
      secondDriver: refreshed.secondDriver?.enabled ? { enabled: true, fullName: refreshed.secondDriver.fullName } : { enabled: false },
    },
    templateVars: {
      customer_name: vars.customer_name,
      customer_dob: vars.customer_dob,
      customer_address: vars.customer_address,
      driver_license: vars.driver_license,
      car_make: vars.car_make,
      pickup_date: vars.pickup_date,
      total_price: vars.total_price,
      second_driver_name: vars.second_driver_name,
    },
    missing,
    htmlRendered: {
      fullHtmlLength: fullHtml.length,
      hasPlaceholders: fullHtml.includes('{{'),
      hasCustomerName: fullHtml.includes('Alice Johnson'),
      sampleHtml: fullHtml.substring(0, 500),
    },
  }, null, 2));

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
