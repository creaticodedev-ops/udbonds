/**
 * Offline: AgencySettings resolution + wa.me URL dial selection.
 * Run: node scripts/verify-whatsapp-settings.mjs
 */
import assert from 'assert';
import {
  buildGuestToAgencyWhatsAppUrl,
  buildCompletionToAgencyWhatsAppUrl,
  normalizeWhatsAppDial,
} from '../services/whatsappNotify.js';

assert.equal(normalizeWhatsAppDial('+212 665-330-116'), '212665330116');
assert.equal(normalizeWhatsAppDial('0665330116'), '212665330116');

const reservationDial = '212611111111';
const confirmationDial = '212622222222';

const reservationUrl = buildGuestToAgencyWhatsAppUrl(
  {
    reservationId: 'RES-TEST',
    customerName: 'Test',
    customerPhone: '+212600000000',
    vehicle: 'Dacia Duster',
    pickupLocation: 'Casa',
    returnLocation: 'Casa',
    pickupDate: new Date('2026-08-10T10:00:00Z'),
    returnDate: new Date('2026-08-12T10:00:00Z'),
    price: 1000,
    agencyName: 'Atlas Drift',
  },
  reservationDial,
  'Atlas Drift',
);
assert.ok(reservationUrl.startsWith(`https://wa.me/${reservationDial}?text=`));
assert.ok(!reservationUrl.includes(confirmationDial));
assert.ok(reservationUrl.includes(encodeURIComponent('Atlas Drift')));

const confirmationUrl = buildCompletionToAgencyWhatsAppUrl({
  reservationId: 'RES-TEST',
  customerName: 'Test',
  customerPhone: '+212600000000',
  vehicle: 'Dacia Duster',
  pickupLocation: 'Casa',
  returnLocation: 'Casa',
  pickupDate: new Date('2026-08-10T10:00:00Z'),
  returnDate: new Date('2026-08-12T10:00:00Z'),
  price: 1000,
  completionUrl: 'https://example.com/complete-booking/token',
  dial: confirmationDial,
  agencyName: 'Sahara Pulse',
});
assert.ok(confirmationUrl.startsWith(`https://wa.me/${confirmationDial}?text=`));
assert.ok(confirmationUrl.includes(encodeURIComponent('https://example.com/complete-booking/token')));
assert.ok(confirmationUrl.includes(encodeURIComponent('Sahara Pulse')));

// No dial → empty URL (never invent another agency's WhatsApp number)
const fallbackUrl = buildGuestToAgencyWhatsAppUrl({ reservationId: 'X' });
assert.equal(fallbackUrl, '');

console.log('verify-whatsapp-settings: all assertions passed');
