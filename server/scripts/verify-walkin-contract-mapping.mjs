/**
 * Offline verification: walk-in-shaped booking → buildTemplateVariables
 * ensures no missing/swapped contract fields vs the online completion payload.
 *
 * Run: node scripts/verify-walkin-contract-mapping.mjs
 */
import assert from 'assert';
import { buildTemplateVariables } from '../services/templateEngine.js';
import { applyCompletionDetailsToBooking, isSyntheticWalkInEmail } from '../utils/applyCompletionDetails.js';

const WALK_IN = {
  reservationId: 'RES-WALKIN01',
  channel: 'walk_in',
  customerName: 'Walkin Locataire',
  customerEmail: 'walkin+612345678@local.americonfort',
  customerPhone: '+212612345678',
  nationality: 'Marocaine',
  dateOfBirth: '1990-04-12',
  placeOfBirth: 'Rabat',
  customerAddress: '45 Avenue Hassan II, Rabat',
  identityDocumentNumber: 'BE998877',
  identityIssuedOn: '2018-01-20',
  driverLicenseNumber: 'PERM-WALK-11',
  driverLicenseExpiry: '2031-09-01',
  driverLicenseIssuedOn: '2012-06-15',
  passportNumber: 'P-WALK-4455',
  deliveredBy: 'Agent Desk',
  receivedBy: 'Client Walkin',
  fuelLevelStart: '4/4',
  kmDepart: '45210',
  kmRetour: '',
  franchiseAmount: 5000,
  pickupDate: new Date('2026-08-10T10:00:00Z'),
  returnDate: new Date('2026-08-13T10:00:00Z'),
  pickupLocation: 'Casablanca — Airport',
  returnLocation: 'Casablanca — City Center',
  price: 1800,
  paymentStatus: 'paid',
  status: 'confirmed',
  notes: 'Desk cash payment',
  priceBreakdown: {
    days: 3,
    pricePerDay: 500,
    rentalPrice: 1500,
    pickupDeliveryFee: 200,
    dropoffDeliveryFee: 100,
    discountTotal: 0,
    total: 1800,
  },
  secondDriver: {
    enabled: true,
    fullName: 'Second Walkin',
    dateOfBirth: '1988-02-02',
    nationality: 'Française',
    phone: '+33601020304',
    driverLicenseNumber: 'FR-WALK-22',
    driverLicenseExpiry: '2030-01-01',
    passportNumber: 'FR-P-22',
  },
  car: {
    brand: 'Dacia',
    model: 'Duster',
    year: 2023,
    category: 'SUV',
    licensePlate: '12345-A-6',
    pricePerDay: 500,
    securityDeposit: 4000,
    mileage: 40000,
  },
  completion: {
    signatureUrl: '',
  },
};

assert.equal(isSyntheticWalkInEmail(WALK_IN.customerEmail), true);

const vars = buildTemplateVariables(WALK_IN, {
  contractNumber: WALK_IN.reservationId,
  agency: { currency: 'MAD', name: 'HDN Car Test' },
  template: {},
});

const expect = {
  reservation_id: 'RES-WALKIN01',
  customer_name: 'Walkin Locataire',
  customer_email: '—', // synthetic email must not print
  customer_phone: '+212612345678',
  customer_nationality: 'Marocaine',
  customer_dob: '1990-04-12',
  customer_birth_place: 'Rabat',
  customer_address: '45 Avenue Hassan II, Rabat',
  identity_document: 'BE998877',
  identity_issued_on: '2018-01-20',
  driver_license: 'PERM-WALK-11',
  driver_license_expiry: '2031-09-01',
  driver_license_issued_on: '2012-06-15',
  passport_number: 'P-WALK-4455',
  delivered_by: 'Agent Desk',
  received_by: 'Client Walkin',
  fuel_level_start: '4/4',
  km_depart: '45210',
  franchise_amount: 'MAD 5000.00',
  pickup_location: 'Casablanca — Airport',
  return_location: 'Casablanca — City Center',
  rental_days: '3',
  total_price: 'MAD 1800.00',
  payment_status: 'paid',
  booking_method: 'Walk-in',
  second_driver_yes_no: 'Oui',
  second_driver_name: 'Second Walkin',
  second_driver_license: 'FR-WALK-22',
  second_driver_phone: '+33601020304',
  car_brand: 'Dacia',
  car_model: 'Duster',
  car_registration: '12345-A-6',
};

const failures = [];
for (const [key, wanted] of Object.entries(expect)) {
  if (vars[key] !== wanted) {
    failures.push(`${key}: got ${JSON.stringify(vars[key])} expected ${JSON.stringify(wanted)}`);
  }
}

// Explicit no-swap checks
if (vars.identity_document === vars.passport_number) {
  failures.push('identity_document incorrectly equals passport_number');
}
if (vars.identity_document === 'P-WALK-4455') {
  failures.push('identity_document was filled from passport (swap bug)');
}
if (vars.passport_number === 'BE998877') {
  failures.push('passport_number was filled from identity (swap bug)');
}

// applyCompletionDetails parity with online
const booking = { secondDriver: { enabled: false } };
applyCompletionDetailsToBooking(booking, {
  customerAddress: 'X',
  placeOfBirth: 'Y',
  identityDocumentNumber: 'ID1',
  identityIssuedOn: '2020-01-01',
  driverLicenseIssuedOn: '2015-01-01',
  franchiseAmount: 1234,
  kmDepart: '100',
  fuelLevelStart: '1/2',
  secondDriver: {
    enabled: true,
    fullName: 'B',
    dateOfBirth: '1991-01-01',
    nationality: 'ES',
    phone: '+34',
    driverLicenseNumber: 'L',
    driverLicenseExpiry: '2030-01-01',
    passportNumber: 'P',
  },
});
assert.equal(booking.customerAddress, 'X');
assert.equal(booking.identityDocumentNumber, 'ID1');
assert.equal(booking.franchiseAmount, 1234);
assert.equal(booking.secondDriver.enabled, true);
assert.equal(booking.secondDriver.fullName, 'B');

// Passport-only booking must not put passport into identity_document
const passportOnly = buildTemplateVariables({
  ...WALK_IN,
  identityDocumentNumber: '',
  passportNumber: 'ONLY-PASS',
  customerEmail: 'real@example.com',
});
assert.equal(passportOnly.identity_document, '—');
assert.equal(passportOnly.passport_number, 'ONLY-PASS');
assert.equal(passportOnly.customer_email, 'real@example.com');

if (failures.length) {
  console.error('verify-walkin-contract-mapping FAILED:');
  failures.forEach((f) => console.error(' -', f));
  process.exit(1);
}

console.log('verify-walkin-contract-mapping: all assertions passed');
console.log(`Checked ${Object.keys(expect).length} mapped fields + swap guards + applyCompletionDetails`);
