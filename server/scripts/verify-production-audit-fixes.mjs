/**
 * Offline retests for production-audit hotfixes.
 * Run: node scripts/verify-production-audit-fixes.mjs
 */
import assert from 'assert';
import { renderTemplate, buildTemplateVariables } from '../services/templateEngine.js';
import { applyCompletionDetailsToBooking } from '../utils/applyCompletionDetails.js';
import { getPaymentMode } from '../services/paymentService.js';

// --- Upload path normalization (mirrors middleware logic) ---
const normalizeUploadRelPath = (rawPath) => {
  let decoded;
  try {
    decoded = decodeURIComponent(String(rawPath || ''));
  } catch {
    return null;
  }
  return decoded.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
};
const isProtected = (rel) =>
  ['documents', 'contracts', 'templates', 'tmp'].some(
    (p) => rel === p || rel?.startsWith(`${p}/`),
  );

assert.equal(isProtected(normalizeUploadRelPath('/%64ocuments/files/x.jpg')), true);
assert.equal(isProtected(normalizeUploadRelPath('/documents/files/x.jpg')), true);
assert.equal(isProtected(normalizeUploadRelPath('/contracts/owner/a.pdf')), true);
assert.equal(isProtected(normalizeUploadRelPath('/cars/public.webp')), false);

// --- XSS: guest fields escaped in templates ---
const html = renderTemplate('<p>{{customer_name}}</p><div>{{customer_signature_html}}</div>', {
  customer_name: '<img src=x onerror=alert(1)>',
  customer_signature_html: '<img src="data:image/png;base64,xx" alt="sig" />',
});
assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
assert.ok(html.includes('<img src="data:image/png;base64,xx" alt="sig" />'));
assert.ok(!html.includes('<img src=x onerror=alert(1)>'));

const vars = buildTemplateVariables({
  reservationId: 'RES-X',
  customerName: '<script>alert(1)</script>',
  customerEmail: 'a@b.com',
  customerPhone: '+2126',
  customerAddress: 'A & B <C>',
  secondDriver: {
    enabled: true,
    fullName: '<b>Hack</b>',
    dateOfBirth: '1990-01-01',
    nationality: 'X',
    driverLicenseNumber: 'L',
    driverLicenseExpiry: '2030-01-01',
    passportNumber: 'P',
    phone: '1',
  },
  car: { brand: 'Dacia', model: 'Logan', pricePerDay: 100 },
  price: 100,
  priceBreakdown: { days: 1, pricePerDay: 100, rentalPrice: 100 },
});
// Section builders escape at construction time; plain fields escape in renderTemplate.
assert.ok(vars.second_driver_section.includes('&lt;b&gt;Hack&lt;/b&gt;'));
assert.ok(!vars.second_driver_section.includes('<b>Hack</b>'));
const renderedCustomer = renderTemplate('<p>{{customer_name}}</p>{{customer_address}}', vars);
assert.ok(renderedCustomer.includes('&lt;script&gt;'));
assert.ok(renderedCustomer.includes('A &amp; B &lt;C&gt;'));
assert.ok(!renderedCustomer.includes('<script>'));

// --- Customer scope cannot set desk financial fields ---
const booking = { franchiseAmount: 5000, kmDepart: '100', deliveredBy: 'Agent' };
applyCompletionDetailsToBooking(
  booking,
  { franchiseAmount: 0, kmDepart: '999999', deliveredBy: 'Evil', customerAddress: '12 Rue X' },
  { scope: 'customer' },
);
assert.equal(booking.franchiseAmount, 5000);
assert.equal(booking.kmDepart, '100');
assert.equal(booking.deliveredBy, 'Agent');
assert.equal(booking.customerAddress, '12 Rue X');

applyCompletionDetailsToBooking(booking, { franchiseAmount: 100 }, { scope: 'desk' });
assert.equal(booking.franchiseAmount, 100);

// --- Demo payments fail closed without explicit opt-in ---
const prevMode = process.env.PAYMENT_MODE;
const prevAllow = process.env.ALLOW_DEMO_PAYMENT;
const prevStripe = process.env.STRIPE_SECRET_KEY;
const prevNode = process.env.NODE_ENV;
delete process.env.STRIPE_SECRET_KEY;
process.env.PAYMENT_MODE = 'demo';
process.env.ALLOW_DEMO_PAYMENT = '';
process.env.NODE_ENV = 'development';
assert.equal(getPaymentMode(), 'disabled');
process.env.ALLOW_DEMO_PAYMENT = 'true';
assert.equal(getPaymentMode(), 'demo');
process.env.PAYMENT_MODE = prevMode;
process.env.ALLOW_DEMO_PAYMENT = prevAllow;
process.env.STRIPE_SECRET_KEY = prevStripe;
process.env.NODE_ENV = prevNode;

console.log('verify-production-audit-fixes: all assertions passed');
