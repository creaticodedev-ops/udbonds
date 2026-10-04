/**
 * Static audit: paths referenced by the booking confirmation workflow vs route files.
 * Usage: node server/scripts/audit-booking-workflow-routes.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const required = [
  { method: 'POST', path: '/api/booking-completion/owner/ensure-link', file: 'routes/bookingCompletionRoutes.js' },
  { method: 'POST', path: '/api/booking-completion/owner/resend-link', file: 'routes/bookingCompletionRoutes.js' },
  { method: 'POST', path: '/api/bookings/owner/completion/ensure-link', file: 'routes/bookingRoutes.js' },
  { method: 'POST', path: '/api/bookings/change-status', file: 'routes/bookingRoutes.js' },
  { method: 'GET', path: '/api/booking-completion/:token', file: 'routes/bookingCompletionRoutes.js' },
  { method: 'POST', path: '/api/booking-completion/:token/details', file: 'routes/bookingCompletionRoutes.js' },
  { method: 'POST', path: '/api/booking-completion/:token/signature', file: 'routes/bookingCompletionRoutes.js' },
];

const routePatterns = {
  'routes/bookingCompletionRoutes.js': [
    'post("/owner/ensure-link"',
    'post("/owner/resend-link"',
    'get("/:token"',
    'post("/:token/details"',
    'post("/:token/signature"',
  ],
  'routes/bookingRoutes.js': [
    "post('/owner/completion/ensure-link'",
    "post('/change-status'",
  ],
};

let failed = false;
for (const r of required) {
  const content = fs.readFileSync(path.join(root, r.file), 'utf8');
  const patterns = routePatterns[r.file] || [];
  const ok = patterns.some((p) => content.includes(p));
  if (!ok) {
    console.error(`MISSING in ${r.file}: ${r.method} ${r.path}`);
    failed = true;
  } else {
    console.log(`OK ${r.method} ${r.path}`);
  }
}

const clientRefs = [
  'client/src/pages/owner/ManageBookings.jsx',
  'client/src/pages/CompleteBooking.jsx',
];
const clientRoot = path.join(root, '..');
for (const rel of clientRefs) {
  const full = path.join(clientRoot, rel.replace(/\//g, path.sep));
  if (!fs.existsSync(full)) continue;
  const text = fs.readFileSync(full, 'utf8');
  if (text.includes('/api/api/')) {
    console.error(`BAD client double /api in ${rel}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log('Audit passed.');
